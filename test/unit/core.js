'use strict';

/* globals describe, beforeEach, afterEach, it, expect, Imager, jQuery, document, sinon */

function loadFixtures(location){
  var fixtures = document.createElement('div');
  fixtures.id = 'karma-fixtures';
  fixtures.innerHTML = window.__html__['test/fixtures/'+location+'.html'];
  document.body.appendChild(fixtures);

  return fixtures;
}

describe('Imager.js', function(){
  describe('handling {width} in data-src', function(){
    var fixtures;

    afterEach(function(){
        if(fixtures){
          document.body.removeChild(fixtures);
        }
    });

    it('should does not use RegExp anymore', function(done){
      fixtures = loadFixtures('data-src-old');
      var imgr = new Imager({ availableWidths: [320, 640] });

      setTimeout(function(){
        Object.keys(imgr.cache).forEach(function(key){
          var replacement = imgr.cache[key];

          expect(replacement.nodeName).to.eq('IMG');
          expect(replacement.getAttribute('src')).to.eq(replacement.getAttribute('data-src'));
        });

        done();
      }, 100);
    });

    it('should replace {width} by the computed width or a fallback', function(done){
      fixtures = loadFixtures('data-src-new');
      var imgr = new Imager({ availableWidths: [320, 640] });

      setTimeout(function(){
        expect(imgr.cache['base/Demo - Grunt/Assets/Images/Generated/C-320.jpg'].getAttribute('data-src')).to.eq('base/Demo - Grunt/Assets/Images/Generated/C-{width}.jpg');
        expect(imgr.cache['base/Demo - Grunt/Assets/Images/Generated/B-640.jpg'].getAttribute('data-src')).to.eq('base/Demo - Grunt/Assets/Images/Generated/B-{width}.jpg');
        expect(imgr.cache['base/test/fixtures/media-320/fillmurray.jpg'].getAttribute('data-src')).to.eq('base/test/fixtures/media-{width}/fillmurray.jpg');

        done();
      }, 100);
    });
  });

  describe('handling {pixel_ratio}', function(){
    var sandbox;

    beforeEach(function(){
        sandbox = sinon.sandbox.create();
    });

    afterEach(function(){
        sandbox.restore();
    });

    it('should always return a pixelRatio', function(){
        expect(Imager.getPixelRatio()).to.be.above(0);

        sandbox.stub(window, 'devicePixelRatio', undefined);
        expect(window.devicePixelRatio).to.be.an('undefined');
        expect(Imager.getPixelRatio()).to.be.eq(1);
    });

    it('should transform {pixel_ratio} as "" or "-<pixel ratio value>x"', function(){
        expect(Imager.transforms['pixel_ratio'](1)).to.eq('');
        expect(Imager.transforms['pixel_ratio'](0.5)).to.eq('-0.5x');
        expect(Imager.transforms['pixel_ratio'](1.5)).to.eq('-1.5x');
    });

    it('should replace {pixel_ratio} from the `data-src`', function(){
        var dataSrc,
            imgr = new Imager();

        dataSrc = 'http://example.com/img{pixel_ratio}/A-{width}.jpg';
        sandbox.stub(window, 'devicePixelRatio', 1);
        expect(imgr.changeImageSrcToUseNewImageDimensions(dataSrc, 320)).to.eq('http://example.com/img/A-320.jpg');
        sandbox.stub(window, 'devicePixelRatio', 2);
        expect(imgr.changeImageSrcToUseNewImageDimensions(dataSrc, 320)).to.eq('http://example.com/img-2x/A-320.jpg');

        dataSrc = 'http://example.com/img{pixel_ratio}/A.jpg';
        sandbox.stub(window, 'devicePixelRatio', 1);
        expect(imgr.changeImageSrcToUseNewImageDimensions(dataSrc, 320)).to.eq('http://example.com/img/A.jpg');
        sandbox.stub(window, 'devicePixelRatio', 2);
        expect(imgr.changeImageSrcToUseNewImageDimensions(dataSrc, 320)).to.eq('http://example.com/img-2x/A.jpg');
    });
  });
});