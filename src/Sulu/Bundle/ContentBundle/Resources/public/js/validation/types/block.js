/*
 * This file is part of the Husky Validation.
 *
 * (c) MASSIVE ART WebServices GmbH
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 *
 */

define([
    'type/default',
    'app-config'
], function(Default, AppConfig) {

    'use strict';

    var initializeTypeSelect = function($parent, options, callback) {
        $parent.find('.type-select').parent().removeClass('hidden');
        Husky.start([
            {
                name: 'select@husky',
                options: {
                    el: $parent.find('.type-select'),
                    instanceName: 'change' + options.index,
                    valueName: 'title',
                    selectCallback: callback,
                    data: this.types,
                    defaultLabel: $.grep(this.types, function(type) {
                        return type.id === options.type;
                    })[0].title
                }
            }
        ]);
    };

    return function($el, options, form) {
        var defaults = {},

            subType = {
                initializeSub: function() {
                    var i, len, item, selectData = [];
                    this.templates = {};
                    for (i = 0, len = this.options.config.length; i < len; i++) {
                        item = this.options.config[i];
                        this.templates[item.data] = App.dom.find('#' + item.tpl, this.$el).html();

                        item.id = item.data;
                        item.name = App.translate(item.title);
                        selectData.push(item);
                    }

                    this.id = this.$el.attr('id');
                    this.propertyName = App.dom.data(this.$el, 'mapperProperty');
                    this.types = selectData;

                    this.$addButton = $('#' + this.id + '-add');
                    if (this.getMinOccurs() !== this.getMaxOccurs()) {
                        this.initSelectComponent(selectData);
                    } else {
                        App.dom.remove(this.$addButton);
                    }

                    this.bindDomEvents();
                    this.checkSortable();
                    this.setValue([]);
                },

                getChildren: function() {
                    return this.$el.children();
                },

                getMinOccurs: function() {
                    return this.options.min;
                },

                getMaxOccurs: function() {
                    return this.options.max;
                },

                canAdd: function() {
                    var length = this.getChildren().length;
                    return this.getMaxOccurs() === null || length < this.getMaxOccurs();
                },

                canRemove: function() {
                    var length = this.getChildren().length;
                    return length > this.getMinOccurs();
                },

                initSelectComponent: function(selectData) {
                    App.start([
                        {
                            name: 'select@husky',
                            options: {
                                el: this.$addButton,
                                instanceName: this.id,
                                defaultLabel: App.translate('sulu.content.add-type'),
                                fixedLabel: true,
                                style: 'action',
                                icon: 'plus-circle',
                                data: (selectData.length > 1 ? selectData : []),
                                repeatSelect: true,
                                selectCallback: function(item) {
                                    this.addChild(item, {}, true);
                                }.bind(this),
                                deselectCallback: function(item) {
                                    this.addChild(item, {}, true);
                                }.bind(this),
                                noItemsCallback: function() {
                                    this.addChild(this.types[0].data, {}, true);
                                }.bind(this)
                            }
                        }
                    ]);
                },

                bindDomEvents: function() {
                    this.$el.on('click', '*[data-mapper-remove="' + this.propertyName + '"]', this.removeBlockHandler.bind(this));

                    $('#sort-text-blocks-' + this.id).on('click', this.showSortMode.bind(this)); //TODO remove
                    $('#edit-text-blocks-' + this.id).on('click', this.showEditMode.bind(this));
                },

                removeBlockHandler: function(event) {
                    var action = function() {
                        var $removeButton = $(event.target),
                            $element = $removeButton.closest('.' + this.propertyName + '-element');

                        if (this.canRemove()) {
                            this.form.removeFields($element);
                            $element.remove();

                            $(form.$el).trigger('form-remove', [this.propertyName]);
                            this.checkFullAndEmpty();
                        }
                    }.bind(this);
                    // show warning dialog
                    Husky.emit(
                        'sulu.overlay.show-warning', 'sulu.overlay.be-careful', 'sulu.overlay.delete-desc',
                        null, action
                    );
                },

                checkSortable: function() {
                    // check for dragable
                    if (this.getChildren().length <= 1) {
                        this.setSortable(false);
                    } else {
                        this.setSortable(true);
                    }
                },

                validate: function() {
                    // TODO validate
                    return true;
                },

                addChild: function(type, data, fireEvent, index) {
                    var options, template, $template,
                        dfd = App.data.deferred();

                    if (typeof index === 'undefined' || index === null) {
                        index = this.getChildren().length;
                    }

                    if (!this.templates.hasOwnProperty(type)) {
                        type = this.options.default;
                    }

                    if (this.canAdd()) {
                        // remove index
                        App.dom.remove(App.dom.find('> *:nth-child(' + (index + 1) + ')', this.$el));

                        // FIXME this should not be necessary (see https://github.com/sulu-io/sulu/issues/1263)
                        data.type = type;

                        // render block
                        options = $.extend({}, {index: index, translate: App.translate, type: type}, data);
                        template = _.template(this.templates[type], options, form.options.delimiter);
                        $template = $(template);

                        App.dom.insertAt(index, '> *', this.$el, $template);

                        if (this.types.length > 1) {
                            initializeTypeSelect.call(this, $template, options, function(item) {
                                var data = form.mapper.getData($template);
                                Husky.stop($template.find('*'));
                                this.addChild(item, data, true, $template.index());
                            }.bind(this));
                        }

                            // remove delete button
                        if (this.getMinOccurs() === this.getMaxOccurs()) {
                            App.dom.remove(App.dom.find('.options-remove', $template));
                        }

                        form.initFields($template).then(function() {
                            form.mapper.setData(data, $template).then(function() {
                                dfd.resolve();
                                if (!!fireEvent) {
                                    $(form.$el).trigger('form-add', [this.propertyName, data, index]);
                                }
                            }.bind(this));
                        }.bind(this));

                        this.checkFullAndEmpty();
                    } else {
                        dfd.resolve();
                    }
                    return dfd.promise();
                },

                checkFullAndEmpty: function() {
                    this.$addButton.removeClass('empty');
                    this.$addButton.removeClass('full');
                    this.$el.removeClass('empty');
                    this.$el.removeClass('full');

                    if (!this.canAdd()) {
                        this.$addButton.addClass('full');
                        this.$el.addClass('full');
                    } else if (!this.canRemove()) {
                        this.$addButton.addClass('empty');
                        this.$el.addClass('empty');
                    }

                    if (this.getChildren().size() <= 1) {
                        $('#text-block-header-' + this.id).hide();
                    } else {
                        $('#text-block-header-' + this.id).show();
                    }
                },

                internalSetValue: function(value) {
                    var i, len, count, item,
                        dfd = App.data.deferred(),
                        resolve = function() {
                            count--;
                            if (count <= 0) {
                                dfd.resolve();
                            }
                        };

                    this.form.removeFields(this.$el);
                    App.dom.children(this.$el).remove();
                    len = value.length < this.getMinOccurs() ? this.getMinOccurs() : value.length;
                    count = len;

                    if (len > 0) {
                        for (i = 0; i < len; i++) {
                            item = value[i] || {};
                            this.addChild(item.type || this.options.default, item).then(function() {
                                resolve();
                            });
                        }
                    } else {
                        resolve();
                    }

                    return dfd.promise();
                },

                setValue: function(value) {
                    // server returns an object for single block (min: 1, max: 1)
                    if (typeof value === 'object' && !App.dom.isArray(value)) {
                        value = [value];
                    }

                    var resolve = this.internalSetValue(value);
                    resolve.then(function() {
                        App.logger.log('resolved block set value');
                    });
                    return resolve;
                },

                getValue: function() {
                    var data = [];
                    App.dom.children(this.$el).each(function() {
                        data.push(form.mapper.getData($(this)));
                    });
                    return data;
                },

                iterateBlockFields: function($blocks, cb) {
                    if ($blocks.size()) {
                        $.each($blocks, function(idx, block) {
                            var $block = $(block),
                                $fields = $block.find('[data-mapper-property]');

                            if ($fields.size()) {
                                $.each($fields, function(idx, field) {
                                    var $field = $(field),
                                        property = $field.data('property') || {},
                                        tags = property.tags || [];

                                    (cb || $.noop)($field, $block);
                                });
                            }
                        });
                    }
                },

                // TODO: morph to collapse
                showSortMode: function() {
                    var $blocks = this.getChildren(),
                        section = AppConfig.getSection('sulu-content');

                    $('#sort-text-blocks-' + this.id).addClass('hidden');
                    $('#edit-text-blocks-' + this.id).removeClass('hidden');

                    this.$el.addClass('is-sortmode');

                    this.iterateBlockFields($blocks, function($field, $block) {
                        var property = $field.data('property') || {},
                            tags = property.tags || [];

                        if ($field.data('type') === 'textEditor') {
                            App.emit('husky.ckeditor.' + $field.data('aura-instance-name') + '.destroy');
                        }

                        if (tags.length && _.where(tags, {name: section.showInSortModeTag}).length) {
                            this.showSortModeField($field, $block);
                        }
                    }.bind(this));

                    this.checkSortable();
                },

                // TODO remove method
                showSortModeField: function($field, $block) {
                    var content = $field.data('element').getValue(),
                        fieldId = $field.attr('id'),
                        $sortModeField = $('[data-sort-mode-id="' + fieldId + '"]', $block);

                    if ($sortModeField.size()) {
                        $sortModeField
                            .html(!!content && content.replace(/<(?:.|\n)*?>/gm, ''))
                            .addClass('show-in-sortmode');
                    }
                },

                showEditMode: function() {
                    var $blocks = this.getChildren();

                    App.dom.removeClass('#sort-text-blocks-' + this.id, 'hidden');
                    App.dom.addClass('#edit-text-blocks-' + this.id, 'hidden');

                    this.$el.removeClass('is-sortmode');

                    this.iterateBlockFields($blocks, function($field, $block) {
                        $field.removeClass('show-in-sortmode');

                        if ($field.data('type') === 'textEditor') {
                            App.emit('husky.ckeditor.' + $field.data('aura-instance-name') + '.start');
                        }
                    }.bind(this));
                },

                setSortable: function(state) {
                    if (!state) {
                        App.dom.removeClass(this.$el, 'sortable');
                        App.dom.sortable(this.$el, 'destroy');
                    } else if (!App.dom.hasClass(this.$el, 'sortable')) {
                        App.dom.addClass(this.$el, 'sortable');
                    }

                    $(form.$el).trigger('init-sortable');
                }
            };

        return new Default($el, defaults, options, 'block', subType, form);
    };
});
