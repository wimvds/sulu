/*
 * This file is part of the Sulu CMS.
 *
 * (c) MASSIVE ART Webservices GmbH
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 */

define([
    './models/user',
    'sulusecurity/models/role',
    'sulusecurity/models/permission',
    'sulucontact/model/contact',
    './collections/roles',
    './models/userRole'
], function(User, Role, Permission, Contact, Roles, UserRole) {

    'use strict';

    return {

        name: 'Sulu Contact Permissions',

        initialize: function() {

            if (this.options.display === 'form') {
                this.renderForm();
            } else if (this.options.display === 'content') {
                this.renderContent();
            }

            this.bindCustomEvents();
        },

        bindCustomEvents: function() {

            this.sandbox.on('sulu.user.permissions.save', function(data) {
                this.save(data);
            }.bind(this));

            // delete contact
            this.sandbox.on('sulu.user.permissions.delete', function(id) {
                this.confirmDeleteDialog(function(wasConfirmed) {
                    if (wasConfirmed) {
                        var contactModel = Contact.findOrCreate({id: id});

                        this.sandbox.emit('husky.header.button-state', 'loading-save-button');
                        contactModel.destroy({
                            success: function() {
                                this.sandbox.emit('sulu.router.navigate', 'contacts/contacts');
                            }.bind(this)

                        });
                    }
                }.bind(this));
            }, this);
        },

        save: function(data) {
            this.sandbox.emit('husky.header.button-state', 'loading-save-button');

            this.user.set('username', data.user.username);
            this.user.set('contact', this.contact);

            if(!!data.user.password && data.user.password !== '') {
                this.user.set('password', data.user.password);
            } else {
                this.user.set('password', '');
            }

            if (!!data.user.id) { // PUT
                this.user.url = '/admin/api/users/' + data.user.id;
            } else { // POST
                this.user.url = '/admin/api/users';
            }

            // prepare deselected roles
            this.sandbox.util.each(data.deselectedRoles, function(index, value) {
                var userRole;

                if (this.user.get('userRoles').length > 0) {

                    userRole = this.user.get('userRoles').findWhere(
                        {
                            role: this.roles.get(value)
                        }
                    );
                    if (!!userRole) {
                        this.user.get('userRoles').remove(userRole);
                    }
                }

            }.bind(this));

            // prepare selected roles
            this.sandbox.util.each(data.selectedRolesAndConfig, function(index, value) {
                var userRole = new UserRole(),
                    tmp;

                if (this.user.get('userRoles').length > 0) {

                    tmp = this.user.get('userRoles').findWhere(
                        {
                            role: this.roles.get(value.roleId)
                        }
                    );
                    if (!!tmp) {
                        userRole = tmp;
                    }
                }

                userRole.set('role', this.roles.get(value.roleId));
                userRole.set('locales', value.selection);
                this.user.get('userRoles').add(userRole);
            }.bind(this));

            this.user.save(null, {
                success: function(model) {
                    this.sandbox.emit('sulu.user.permissions.saved', model.toJSON());
                }.bind(this),
                error: function() {
                    this.sandbox.logger.log("error while saving profile");
                }.bind(this)

            });
        },

        // render form and load data

        renderForm: function() {

            this.user = null;
            this.contact = null;

            if (!!this.options.id) {
                this.loadRoles();
            } else {
                // TODO error message
                this.sandbox.logger.log('error: form not accessible without contact id');
            }
        },


        renderContent: function() {
            // show navigation submenu
            this.sandbox.sulu.navigation.parseContentNavigation(ContentNavigation, this.options.id, function(navigation) {
                this.sandbox.start([
                    {
                        name: 'content@suluadmin', options: {
                        el: this.options.el,
                        tabsData: navigation,
                        heading: this.sandbox.translate('contact.contacts.title')
                    }
                    }
                ]);
            }.bind(this));
        },

        loadRoles: function() {
            this.roles = new Roles();
            this.roles.fetch({
                success: function() {
                    this.loadUser();
                }.bind(this),
                error: function() {
                    // TODO error message
                }
            });

        },

        loadUser: function() {
            this.user = new User();
            this.user.url = '/admin/api/security/users?contactId=' + this.options.id;
            this.user.fetch({
                success: function() {
                    this.contact = this.user.get('contact').toJSON();
                    this.startComponent();
                }.bind(this),
                error: function() {
                    // no user with contact id found - user has to be created
                    // TODO check status code to be sure
                    this.loadContact();
                }.bind(this)
            });
        },

        loadContact: function() {
            this.contact = new Contact({id: this.options.id});
            this.contact.fetch({
                success: function() {
                    this.contact = this.contact.toJSON();
                    this.startComponent();
                }.bind(this),
                error: function() {
                    // TODO error message
                    this.sandbox.logger.log("failed to load contact");
                }.bind(this)
            });
        },

        startComponent: function() {
            var data = {};
            data.contact = this.contact;

            if(!!this.user) {
                data.user = this.user.toJSON();
            }

            data.roles = this.roles.toJSON();

            this.sandbox.start([
                {
                    name: 'permissions/components/form@sulusecurity',
                    options: {
                        el: this.$el,
                        data: data
                    }}
            ]);
        },

        // dialog

        /**
         * @var ids - array of ids to delete
         * @var callback - callback function returns true or false if data got deleted
         */
        confirmDeleteDialog: function(callbackFunction) {
            // check if callback is a function
            if (!!callbackFunction && typeof(callbackFunction) !== 'function') {
                throw 'callback is not a function';
            }

            // show dialog
            this.sandbox.emit('sulu.dialog.confirmation.show', {
                content: {
                    title: "Be careful!",
                    content: "<p>The operation you are about to do will delete data.<br/>This is not undoable!</p><p>Please think about it and accept or decline.</p>"
                },
                footer: {
                    buttonCancelText: "Don't do it",
                    buttonSubmitText: "Do it, I understand"
                },
                callback: {
                    submit: function() {
                        this.sandbox.emit('husky.dialog.hide');
                        if (!!callbackFunction) {
                            callbackFunction(true);
                        }
                    }.bind(this),
                    cancel: function() {
                        this.sandbox.emit('husky.dialog.hide');
                        if (!!callbackFunction) {
                            callbackFunction(false);
                        }
                    }.bind(this)
                }
            });
        }
    };
});
