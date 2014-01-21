'use strict';

/* globals describe, beforeEach, afterEach, it, expect, Imager, jQuery, document, sinon */

describe('Imager.js', function () {
    describe('constructor', function () {
        var fixtures;

        afterEach(function () {
            if (fixtures) {
                document.body.removeChild(fixtures);
            }
        });

        it('should initialise without arguments', function (done) {
            fixtures = loadFixtures('regular');
            var imgr = new Imager();

            runAfterAnimationFrame(function () {
                expect(imgr.initialized).to.eq(true);
                expect(imgr.scrolled).to.eq(false);
                expect(imgr.divs).to.have.length.of(5);
                expect(imgr.selector).to.eq('.delayed-image-load');

                done();
            });
        });

        it('should initialise with one argument, the options', function () {
            fixtures = loadFixtures('regular');
            var imgr = new Imager({ selector: '#main .delayed-image-load' });

            expect(imgr.divs).to.have.length.of(3);
            expect(imgr.selector).to.eq('#main .delayed-image-load');
        });

        it('should target elements with a string as first argument', function (done) {
            fixtures = loadFixtures('regular');
            var imgr = new Imager('#main .delayed-image-load');

            runAfterAnimationFrame(function () {
                expect(imgr.initialized).to.eq(true);
                expect(imgr.scrolled).to.eq(false);
                expect(imgr.divs).to.have.length.of(3);
                expect(imgr.selector).to.eq('#main .delayed-image-load');

                done();
            });
        });

        it('should target elements contained in a static NodeList collection', function (done) {
            fixtures = loadFixtures('regular');
            var imgr = new Imager(document.querySelectorAll('#main .delayed-image-load'));

            runAfterAnimationFrame(function () {
                expect(imgr.initialized).to.eq(true);
                expect(imgr.scrolled).to.eq(false);
                expect(imgr.divs).to.have.length.of(3);
                expect(imgr.selector).to.eq(null);

                done();
            });
        });

        it('should target elements contained in a live NodeList collection', function (done) {
            fixtures = loadFixtures('regular');
            var imgr = new Imager(document.getElementById('main').getElementsByClassName('delayed-image-load'));

            runAfterAnimationFrame(function () {
                expect(imgr.initialized).to.eq(true);
                expect(imgr.scrolled).to.eq(false);
                expect(imgr.divs).to.have.length.of(3);
                expect(imgr.selector).to.eq(null);

                done();
            });
        });

        it('should target elements contained in a third-party library collection', function (done) {
            fixtures = loadFixtures('regular');
            var imgr = new Imager(jQuery('#main .delayed-image-load'));

            runAfterAnimationFrame(function () {
                expect(imgr.initialized).to.eq(true);
                expect(imgr.scrolled).to.eq(false);
                expect(imgr.divs).to.have.length.of(3);
                expect(imgr.selector).to.eq(null);

                done();
            });
        });
    });

    describe('availableWidths', function () {
        var sandbox;

        beforeEach(function () {
            sandbox = sinon.sandbox.create();
        });

        afterEach(function () {
            sandbox.restore();
        });

        it('should select the closest smallest available image width', function () {
            var imgr = new Imager({ availableWidths: [320, 640, 1024] });
            var img = { clientWidth: 320 };   // stubbing the clientWidth read-only value does not work

            sandbox.stub(img, 'clientWidth', 319);
            expect(imgr.determineAppropriateResolution(img)).to.eq(320);

            sandbox.stub(img, 'clientWidth', 320);
            expect(imgr.determineAppropriateResolution(img)).to.eq(320);

            sandbox.stub(img, 'clientWidth', 639);
            expect(imgr.determineAppropriateResolution(img)).to.eq(640);

            sandbox.stub(img, 'clientWidth', 640);
            expect(imgr.determineAppropriateResolution(img)).to.eq(640);

            sandbox.stub(img, 'clientWidth', 1030);
            expect(imgr.determineAppropriateResolution(img)).to.eq(1024);
        });

        it('can be a function computing a value for you', function (done) {
            // this example will always compute sizes 8 pixels by 8 pixels
            // we need to stub it for now as events are triggered automatically and generates exceptions we can escape
            var imgr = new Imager();

            setTimeout(function () {
                imgr.availableWidths = function (image) {
                    return image.clientWidth - image.clientWidth % 8 + (1 * (image.clientWidth % 8 ? 8 : 0));
                };

                var img = { clientWidth: 320 };
                var spy = sandbox.spy(imgr, 'availableWidths');

                // sinon stub api wasn't working so we're manually stubbing instead
                img.clientWidth = 7;
                expect(function () {
                    imgr.replaceImagesBasedOnScreenDimensions(img);
                }).to.throw();
                expect(spy.returned(8)).to.eq(true);

                img.clientWidth = 8;
                expect(function () {
                    imgr.replaceImagesBasedOnScreenDimensions(img);
                }).to.throw();
                expect(spy.returned(8)).to.eq(true);

                img.clientWidth = 9;
                expect(function () {
                    imgr.replaceImagesBasedOnScreenDimensions(img);
                }).to.throw();
                expect(spy.returned(16)).to.eq(true);

                done();
            }, 100);

        });
    });

    describe('devicePixelRatio', function(){
        var sandbox, imgrOptions = { availablePixelRatios: [1, 1.3, 2] };

        beforeEach(function () {
            sandbox = sinon.sandbox.create();
        });

        afterEach(function () {
            sandbox.restore();
        });

        it('should pick a value of 1 if the device pixel ratio is lower than 1', function(){
            sandbox.stub(Imager, 'getPixelRatio', function(){ return 0.8 });
            expect(new Imager(imgrOptions)).to.have.property('devicePixelRatio', 1);
        });

        it('should pick a value of 1.3 if the device pixel ratio is equal to 1.3', function(){
            sandbox.stub(Imager, 'getPixelRatio', function(){ return 1.3 });
            expect(new Imager(imgrOptions)).to.have.property('devicePixelRatio', 1.3);
        });

        it('should pick the biggest ratio if the device pixel ratio is greater than the biggest available one', function(){
            sandbox.stub(Imager, 'getPixelRatio', function(){ return 3 });
            expect(new Imager(imgrOptions)).to.have.property('devicePixelRatio', 2);
        });
    });

  describe('getPageOffsetGenerator', function(){
    var sandbox;

    beforeEach(function(){
      sandbox = sinon.sandbox.create();
    });

    afterEach(function(){
      sandbox.restore();
    });

    it('should use `window.pageYOffset` if the property is available', function(){
      var pageYOffsetIsAvailable = true;
      var generator = Imager.getPageOffsetGenerator(pageYOffsetIsAvailable);

      expect(generator.toString()).to.have.string('window.pageYOffset');
    });

    it('should rather use `document.documentElement.scrollTop` if `window.pageYOffset` is not available', function(){
      var pageYOffsetIsAvailable = false;
      var generator = Imager.getPageOffsetGenerator(pageYOffsetIsAvailable);

      expect(generator.toString()).to.have.string('document.documentElement.scrollTop');
    });
  });
});