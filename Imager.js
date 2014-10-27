;(function (window, document) {
    'use strict';

    /**
     * Imager Strategy Interface
     *
     * It is responsible to prepare, (eventually) replace and update responsive elements.
     *
     * @typedef {Object} ImagerStrategyInterface
     * @property {Function} prepareElements
     * @property {Function} updateElementUrl
     * @property {Function} getDimension
     */

    /**
     * Imager.js configuration options
     *
     * @typedef {Object} ImagerOptions
     * @property {Boolean} cssBackground If true, Imager will update the style.backgroundImage CSS property instead of upgrading elements to <img> nodes
     * @property {Array.<Number>} availableWidths Available widths for your images
     * @property {String} selector Selector to be used to locate your div placeholders
     * @property {String} className Class name to give your resizable images
     * @property {Boolean} onResize If set to true, Imager will update the src attribute of the relevant images
     * @property {Boolean} lazyload Toggle the lazy load functionality on or off
     * @property {Number} scrollDelay Used alongside the lazyload feature (helps performance by setting a higher delay)
     */

    var defaultWidths = [96, 130, 165, 200, 235, 270, 304, 340, 375, 410, 445, 485, 520, 555, 590, 625, 660, 695, 736];

    var nextTick = window.requestAnimationFrame ||
               window.mozRequestAnimationFrame ||
               window.webkitRequestAnimationFrame ||
               function (callback) {
                   window.setTimeout(callback, 1000 / 60);
               };

    var addEvent = (function(){
        if (document.addEventListener){
            return function addStandardEventListener(el, eventName, fn){
                return el.addEventListener(eventName, fn, false);
            };
        }
        else {
            return function addIEEventListener(el, eventName, fn){
                return el.attachEvent('on'+eventName, fn);
            };
        }
    })();


    var getKeys = typeof Object.keys === 'function' ? Object.keys : function (object) {
        var keys = [],
            key;

        for (key in object) {
            keys.push(key);
        }

        return keys;
    };

    function applyEach (collection, callbackEach) {
        var i = 0,
            length = collection.length,
            new_collection = [];

        for (; i < length; i++) {
            new_collection[i] = callbackEach(collection[i], i);
        }

        return new_collection;
    }

    function returnFn(value) { return value; }
    function noop(){}
    function trueFn(){ return true;}


    /**
     * Construct a new Imager instance, passing an optional configuration object.
     *
     * @param {Array|String=} elements
     * @param {ImagerOptions=} opts
     * @constructor
     */
    function Imager (elements, opts) {
        var self = this,
            doc  = document;

        opts = opts || {};

        if (elements !== undefined) {
            // first argument is selector string
            if (typeof elements === 'string') {
                opts.selector = elements;
                elements = undefined;
            }

            // first argument is the `opts` object, `elements` is implicitly the `opts.selector` string
            else if (typeof elements.length === 'undefined') {
                opts = elements;
                elements = undefined;
            }
        }

        // elements interactions
        this.selector         = opts.selector || '.delayed-image-load';
        this.className        = opts.className || 'image-replace';
        this.strategy         = (opts.cssBackground || false) ? backgroundImageStrategy() : imageElementStrategy();

        // placeholder configuration
        this.gif              = doc.createElement('img');
        this.gif.src          = 'data:image/gif;base64,R0lGODlhEAAJAIAAAP///wAAACH5BAEAAAAALAAAAAAQAAkAAAIKhI+py+0Po5yUFQA7';
        this.gif.className    = this.className;
        this.gif.alt          = '';

        // dimensions
        this.widthsMap        = {};
        this.availableWidths  = opts.availableWidths || defaultWidths;
        this.availablePixelRatios = opts.availablePixelRatios || [1, 2];
        this.widthInterpolator = opts.widthInterpolator || returnFn;

        // lazyload (experimental)
        this.lazyload         = opts.hasOwnProperty('lazyload') ? opts.lazyload : false;
        this.scrollDelay      = opts.scrollDelay || 250;

        // events
        this.onResize         = opts.hasOwnProperty('onResize') ? opts.onResize : true;
        this.onImagesReplaced = opts.onImagesReplaced || noop;

        // internal states
        this.refreshPixelRatio();
        this.viewportHeight   = doc.documentElement.clientHeight;
        this.scrolled         = false;

        // Needed as IE8 adds a default `width`/`height` attribute…
        this.gif.removeAttribute('height');
        this.gif.removeAttribute('width');

        this.buildWidthMap();

        if (elements) {
            this.divs = applyEach(elements, returnFn);
            this.selector = null;
        }
        else {
            this.divs = applyEach(doc.querySelectorAll(this.selector), returnFn);
        }

        this.ready(opts.onReady);

        // configuration done, let's start the magic!
        this.strategy.prepareElements(this, this.divs);
        nextTick(function(){
            self.init();
        });
    }

    /**
     * Computes `this.availableWidths` as a function from an array of values.
     * It basically does nothing it `availableWidths` is already a function.
     *
     * @since 0.4.0
     * @returns {Function}
     */
    Imager.prototype.buildWidthMap = function(){
        if (typeof this.availableWidths === 'function') {
            return;
        }

        var widths = this.availableWidths;

        // [320, 640, …]
        if (typeof this.availableWidths.length === 'number') {
            this.widthsMap = Imager.createWidthsMap(widths, this.widthInterpolator, this.devicePixelRatio);
        }
        // { 320: 'small', 640: 'medium', … }
        else {
            this.widthsMap = this.availableWidths;
            widths = getKeys(this.availableWidths);
        }

        widths = widths.sort(function (a, b) {
            return a - b;
        });

        this.availableWidths = function(element){
            return Imager.getClosestValue(this.strategy.getDimension(element), widths);
        };
    };

    Imager.prototype.scrollCheck = function(){
        var self = this;
        var offscreenImageCount = 0;
        var elements = [];

        if (this.scrolled) {
            // collects a subset of not-yet-responsive images and not offscreen anymore
            applyEach(this.divs, function(element){
                if (self.isPlaceholder(element)) {
                    ++offscreenImageCount;

                    if (self.isThisElementOnScreen(element)) {
                        elements.push(element);
                    }
                }
            });

            if (offscreenImageCount === 0) {
                window.clearInterval(self.interval);
            }

            this.changeDivsToEmptyImages(elements);
            this.scrolled = false;
        }
    };

    Imager.prototype.init = function(){
        var self = this;

        this.initialized = true;
        var filterFn = trueFn;

        if (this.lazyload) {
            this.registerScrollEvent();

            filterFn = function(element){
                return self.isPlaceholder(element) === false;
            };
        }
        else {
            this.checkImagesNeedReplacing(this.divs);
        }

        if (this.onResize) {
            this.registerResizeEvent(filterFn);
        }

        this.onReady();
    };

    /**
     * Executes a function when Imager is ready to work
     * It acts as a convenient/shortcut for `new Imager({ onReady: fn })`
     *
     * @since 0.3.1
     * @param {Function} fn
     */
    Imager.prototype.ready = function(fn){
        this.onReady = fn || noop;
    };

    /**
     * Indicates if an element is an Imager placeholder
     *
     * @since 1.3.1
     * @param {HTMLImageElement} element
     * @returns {boolean}
     */
    Imager.prototype.isPlaceholder = function (element){
        return element.src === this.gif.src;
    };

    Imager.prototype.isThisElementOnScreen = function (element) {
        // document.body.scrollTop was working in Chrome but didn't work on Firefox, so had to resort to window.pageYOffset
        // but can't fallback to document.body.scrollTop as that doesn't work in IE with a doctype (?) so have to use document.documentElement.scrollTop
        var offset = Imager.getPageOffset();
        var elementOffsetTop = 0;

        if (element.offsetParent) {
            do {
                elementOffsetTop += element.offsetTop;
            }
            while (element = element.offsetParent);
        }

        return elementOffsetTop < (this.viewportHeight + offset);
    };

    Imager.prototype.checkImagesNeedReplacing = function (images, filterFn) {
        var self = this;
        filterFn = filterFn || trueFn;

        if (!this.isResizing) {
            this.isResizing = true;
            this.refreshPixelRatio();

            applyEach(images, function(image){
                if (filterFn(image)) {
                    self.updateElement(image);
                }
            });

            this.isResizing = false;
            this.onImagesReplaced(images);
        }
    };

    /**
     * Upgrades an image from an empty placeholder to a fully sourced image element
     *
     * @param {HTMLImageElement} element
     */
    Imager.prototype.updateElement = function (element) {
        var naturalWidth = Imager.getNaturalWidth(element);
        var computedWidth = this.availableWidths(element);

        element.width = computedWidth;

        if (!this.isPlaceholder(element) && computedWidth <= naturalWidth) {
            return;
        }

        this.strategy.updateElementUrl(
            element,
            this.filterUrl(element.getAttribute('data-src'), computedWidth)
        );
    };

    /**
     * Updates the device pixel ratio value used by Imager
     *
     * It is performed before each replacement loop, in case a user zoomed in/out
     * and thus updated the `window.devicePixelRatio` value.
     *
     * @api
     * @since 1.0.1
     */
    Imager.prototype.refreshPixelRatio = function refreshPixelRatio(){
        this.devicePixelRatio = Imager.getClosestValue(Imager.getPixelRatio(), this.availablePixelRatios);
    };

    Imager.prototype.filterUrl = function (src, selectedWidth) {
        return src
            .replace(/{width}/g, Imager.transforms.width(selectedWidth, this.widthsMap))
            .replace(/{pixel_ratio}/g, Imager.transforms.pixelRatio(this.devicePixelRatio));
    };

    Imager.getPixelRatio = function getPixelRatio(context){
        return (context || window)['devicePixelRatio'] || 1;
    };

    Imager.createWidthsMap = function createWidthsMap (widths, interpolator, pixelRatio) {
        var map = {},
            i   = widths.length;

        while (i--) {
            map[widths[i]] = interpolator(widths[i], pixelRatio);
        }

        return map;
    };

    Imager.transforms = {
        pixelRatio: function (value) {
            return value === 1 ? '' : '-' + value + 'x';
        },
        width: function (width, map) {
            return map[width] || width;
        }
    };

    /**
     * Returns the closest upper value.
     *
     * ```js
     * var candidates = [1, 1.5, 2];
     *
     * Imager.getClosestValue(0.8, candidates); // -> 1
     * Imager.getClosestValue(1, candidates); // -> 1
     * Imager.getClosestValue(1.3, candidates); // -> 1.5
     * Imager.getClosestValue(3, candidates); // -> 2
     * ```
     *
     * @api
     * @since 1.0.1
     * @param {Number} baseValue
     * @param {Array.<Number>} candidates
     * @returns {Number}
     */
    Imager.getClosestValue = function getClosestValue(baseValue, candidates){
        var i             = candidates.length,
            selectedWidth = candidates[i - 1];

        baseValue = parseFloat(baseValue);

        while (i--) {
            if (baseValue <= candidates[i]) {
                selectedWidth = candidates[i];
            }
        }

        return selectedWidth;
    };

    Imager.prototype.registerResizeEvent = function(filterFn){
        var self = this;

        addEvent(window, 'resize', function(){
            self.checkImagesNeedReplacing(self.divs, filterFn);
        });
    };

    Imager.prototype.registerScrollEvent = function (){
        var self = this;

        this.scrolled = false;

        this.interval = window.setInterval(function(){
            self.scrollCheck();
        }, self.scrollDelay);

        addEvent(window, 'scroll', function(){
            self.scrolled = true;
        });

        addEvent(window, 'resize', function(){
            self.viewportHeight = document.documentElement.clientHeight;
            self.scrolled = true;
        });
    };

    Imager.getPageOffsetGenerator = function getPageVerticalOffset(testCase){
        if(testCase){
            return function(){ return window.pageYOffset; };
        }
        else {
            return function(){ return document.documentElement.scrollTop; };
        }
    };

    /**
     * Returns the naturalWidth of an image element.
     *
     * @since 1.3.1
     * @param {HTMLImageElement} image
     * @return {Number} Image width in pixels
     */
    Imager.getNaturalWidth = (function () {
        if ('naturalWidth' in (new Image())) {
            return function (image) {
                return image.naturalWidth;
            };
        }
        // non-HTML5 browsers workaround
        return function (image) {
            var imageCopy = document.createElement('img');
            imageCopy.src = image.src;
            return imageCopy.width;
        };
    })();

    // This form is used because it seems impossible to stub `window.pageYOffset`
    Imager.getPageOffset = Imager.getPageOffsetGenerator(Object.prototype.hasOwnProperty.call(window, 'pageYOffset'));

    // Exporting for testing purpose
    Imager.applyEach = applyEach;

    /*
     Strategy (classic)
     */
    /**
     * Image Element Strategy (<div> to <img>)
     *
     * @since 0.4.0
     * @returns {ImagerStrategyInterface}
     */
    function imageElementStrategy(){
        var createGif = function (imgr, element) {
            // if the element is already a responsive image then we don't replace it again
            if (element.className.match(new RegExp('(^| )' + imgr.className + '( |$)'))) {
                return element;
            }

            var elementClassName = element.getAttribute('data-class');
            var elementWidth = element.getAttribute('data-width');
            var gif = imgr.gif.cloneNode(false);

            if (elementWidth) {
                gif.width = elementWidth;
                gif.setAttribute('data-width', elementWidth);
            }

            gif.className = (elementClassName ? elementClassName + ' ' : '') + imgr.className;
            gif.setAttribute('data-src', element.getAttribute('data-src'));
            gif.setAttribute('alt', element.getAttribute('data-alt') || imgr.gif.alt);

            element.parentNode.replaceChild(gif, element);

            return gif;
        };

        return {
            prepareElements: function(imgr, elements){
                applyEach(elements, function(element, i){
                    elements[i] = createGif(imgr, element);
                });

                if (imgr.initialized) {
                    imgr.checkImagesNeedReplacing(elements);
                }

            },
            updateElementUrl: function(image, url){
                image.src = url;
                image.removeAttribute('width');
                image.removeAttribute('height');
            },
            getDimension: function(image){
                return image.getAttribute('data-width') || image.parentNode.clientWidth;
            }
        };
    }

    /**
     * Background Image Strategy
     *
     * @since 0.4.0
     * @returns {ImagerStrategyInterface}
     */
    function backgroundImageStrategy(){
        return {
            prepareElements: noop,
            updateElementUrl: function(image, url){
                image.style.backgroundImage = 'url(' + url + ')';
            },
            getDimension: function(element){
                return element.clientWidth;
            }
        };
    }

    /* global module, exports: true, define */
    if (typeof module === 'object' && typeof module.exports === 'object') {
        // CommonJS, just export
        module.exports = exports = Imager;
    } else if (typeof define === 'function' && define.amd) {
        // AMD support
        define(function () { return Imager; });
    } else if (typeof window === 'object') {
        // If no AMD and we are in the browser, attach to window
        window.Imager = Imager;
    }
    /* global -module, -exports, -define */

}(window, document));
