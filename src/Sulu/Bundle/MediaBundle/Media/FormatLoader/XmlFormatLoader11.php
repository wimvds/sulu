<?php

/*
 * This file is part of Sulu.
 *
 * (c) MASSIVE ART WebServices GmbH
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 */

namespace Sulu\Bundle\MediaBundle\Media\FormatLoader;

use Sulu\Bundle\MediaBundle\Media\FormatLoader\Exception\MissingScaleDimensionException;

/**
 * Class XmlFormatLoader for the version 1.1 of the image-formats.
 */
class XmlFormatLoader11 extends BaseXmlFormatLoader
{
    const SCHEMA_URI = 'http://schemas.sulu.io/media/formats-1.1.xsd';

    const SCHEME_PATH = '/schema/formats/formats-1.1.xsd';

    /**
     * {@inheritdoc}
     */
    protected function getKeyFromFormatNode(\DOMNode $formatNode)
    {
        return $this->xpath->query('@key', $formatNode)->item(0)->nodeValue;
    }

    /**
     * {@inheritdoc}
     */
    protected function getInternalFlagFromFormatNode(\DOMNode $formatNode)
    {
        $internalNode = $this->xpath->query('@internal', $formatNode)->item(0);

        if (!$internalNode) {
            return false;
        }

        return 'true' === $internalNode->nodeValue;
    }

    /**
     * {@inheritdoc}
     */
    protected function getMetaFromFormatNode(\DOMNode $formatNode)
    {
        $meta = [
            'title' => [],
        ];

        foreach ($this->xpath->query('x:meta/x:title', $formatNode) as $formatTitleNode) {
            $language = $this->xpath->query('@lang', $formatTitleNode)->item(0)->nodeValue;
            $meta['title'][$language] = $formatTitleNode->nodeValue;
        }

        return $meta;
    }

    /**
     * {@inheritdoc}
     */
    protected function getScaleFromFormatNode(\DOMNode $formatNode)
    {
        $scale = null;

        $formatScaleNode = $this->xpath->query('x:scale', $formatNode)->item(0);
        if (null !== $formatScaleNode) {
            $xNode = $this->xpath->query('@x', $formatScaleNode)->item(0);
            $yNode = $this->xpath->query('@y', $formatScaleNode)->item(0);
            $modeNode = $this->xpath->query('@mode', $formatScaleNode)->item(0);
            $retinaNode = $this->xpath->query('@retina', $formatScaleNode)->item(0);
            $forceRatioNode = $this->xpath->query('@forceRatio', $formatScaleNode)->item(0);
            if (null === $xNode && null === $yNode) {
                throw new MissingScaleDimensionException();
            }

            $forceRatio = static::SCALE_FORCE_RATIO_DEFAULT;
            $retina = static::SCALE_RETINA_DEFAULT;
            if (null !== $forceRatioNode && 'false' === $forceRatioNode->nodeValue) {
                $forceRatio = false;
            }
            if (null !== $retinaNode && 'true' === $retinaNode->nodeValue) {
                $retina = true;
            }

            $scale = [
                'x' => (null !== $xNode) ? intval($xNode->nodeValue) : null,
                'y' => (null !== $yNode) ? intval($yNode->nodeValue) : null,
                'mode' => (null !== $modeNode) ? $modeNode->nodeValue : static::SCALE_MODE_DEFAULT,
                'retina' => $retina,
                'forceRatio' => $forceRatio,
            ];
        }

        return $scale;
    }

    /**
     * {@inheritdoc}
     */
    protected function getTransformationsFromFormatNode(\DOMNode $formatNode)
    {
        $transformations = [];

        foreach ($this->xpath->query('x:transformations/x:transformation', $formatNode) as $transformationNode) {
            $effectNode = $this->xpath->query('x:effect', $transformationNode)->item(0);
            $parametersNode = $this->xpath->query('x:parameters', $transformationNode)->item(0);
            $transformations[] = [
                'effect' => $effectNode->nodeValue,
                'parameters' => $this->getParametersFromNode($parametersNode),
            ];
        }

        return $transformations;
    }
}
