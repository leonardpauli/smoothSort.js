/* smoothSort.js
Adds smooth drag-n-drop sorting to any HTML list with a simple call.
Currently requires jQuery.

Originally created by Leonard Pauli
Copyright © Leonard Pauli 2015-2016

Date: 17/3-2015
Rework: 20/2-2016
Now: 17/4-2016
License: MIT
*/

/* Usage:
  See the first sections in the code for
  - Options
  - Events
  - Callable functions
  - Read only variables

  In event handlers, especially the following could be usefull:
  - this.dragItem
  - this.dragItemOriginalIndex (fromIndex)
  - this.dragItemVirtualIndex (toIndex)

  Quick start:
  1. Load jQuery.js
  -  Load custom css (including specific rules for smoothSort lists
     (eg. ul.drag-active li.moving .handle:active, li.putting-into-place)
  -  Load smoothSort.js
  -  Setup a list (eg. <ul><li>Item <b class="handle">drag me</b></li></ul>)
  2. Invoke smoothSort
  -  $('ul').smoothSort({
      containerScale:1,
      dragEnd: function (opt, item, fromIndex, toIndex) {
        console.log('Drag ended', item, fromIndex, toIndex)
      }
    });
  3. Profit.
*/

(function ($) {
  'use strict';

  $.fn.smoothSort = function(options) {

    // Options
    var opt = $.extend({
      container:$(this),
      containerScale:1,
      dragActiveClass:'drag-active',
      scrollContainer:$(this).parent(),
      scrollDistance:100, // px distance from top/bottom of scrollContainer, to activate autoScroll, or false
      scrollSpeed:10, // max nr of px/50ms
      scrollIntoViewDuration:700, // ms | false
      itemSelector:'li',
      dragItemMaxHeight:100, // px (including padding, excluding border and margin)
      dragItemClass:'moving',
      dragItemTransformStyle:null, // null | 'scale(1.05,1.05)' (appended to 'translate3D(...) ')
      handleSelector:'.handle',
      shouldPutIntoPlace:'animated', // true | false | 'animated'
      cssResetAnimationDelay:500, // if you got css like
      shouldAddDefaultCSS:'auto', // false | true | 'auto' (true if item's css transition value is the default "all 0s ease 0s")
      // li.putting-into-place {transition:max-height 500ms, transform 0.23s ease-out;}
      // then set to longest duration (in this case 500ms)

      // Events
      dragStart:function (opt) {},
      dragMove:function (opt) {},
      dragEnd:function (opt, item, fromIndex, toIndex) {},
      didInit:function (opt) {}
    }, options);

    // Callable functions
    // (defined in "Functions" section)
    opt.putIntoPlace = null;

    // Read only variables
    opt.dragItem = null;
    opt.dragStartPosition       = { x:0, y:0 };
    opt.dragAbsolutePosition    = { x:0, y:0 };
    opt.dragDeltaTransform      = { x:0, y:0 };
    opt.handleMargin            = { x:0, y:0 };
    opt.dragItemInitialHeight   = 0;
    opt.dragItemOriginalIndex   = null;
    opt.dragItemVirtualIndex    = null;
    opt.dragItemInnerSpacing    = getInnerSpacing();
    opt.dragItemOuterSpacing    = getOuterSpacing();

    opt.containerStartPosition  = { x:0, y:0 };
    opt.containerStartSize      = { w:0, h:0 };
    opt.containerTranslate      = { x:0, y:0 };

    opt.scrollOffset            = { x:0, y:0 };
    opt.scrollContainerPosition = { x:0, y:0 };
    opt.scrollContainerSize     = { w:0, h:0 };
    opt.scrollIntervalId        = null;


    // Events

    var dragStart = function (dragItem, p) {

      opt.dragItem              = dragItem;
      opt.dragStartPosition     = {x:p.x,y:p.y};
      opt.dragAbsolutePosition  = {x:p.x,y:p.y};
      opt.dragDeltaTransform    = {x:0,y:0};
      opt.dragItemOriginalIndex = getItemIndex(opt.dragItem);

      // Add drag-active classes
      opt.container.addClass(opt.dragActiveClass);
      opt.dragItem.addClass(opt.dragItemClass);
      
      addDefaultCssForList(opt.shouldAddDefaultCSS);
 
      // Update values
      opt.scrollOffset.x = opt.scrollContainer.scrollLeft();
      opt.scrollOffset.y = opt.scrollContainer.scrollTop();

      var containerOffset             = opt.scrollContainer.offset() || {top:0,left:0};
      opt.scrollContainerPosition.x   = containerOffset.left;
      opt.scrollContainerPosition.y   = containerOffset.top;
      opt.scrollContainerSize.w       = opt.scrollContainer.width();
      opt.scrollContainerSize.h       = opt.scrollContainer.height();
      var windowHeight                = window.innerHeight || document.documentElement.clientHeight;
      opt.scrollContainerSize.h       = Math.min(opt.scrollContainerSize.h, windowHeight - opt.scrollContainerPosition.y); // TODO - max or min?
      
      containerOffset                 = opt.container.offset(); // Non-jQuery: getOffsetToParent(opt.container.get(0), opt.scrollContainer.get(0)).x/.y
      opt.containerStartPosition.x    = containerOffset.left;
      opt.containerStartPosition.y    = containerOffset.top;
      opt.containerStartSize.w        = opt.container.width();
      opt.containerStartSize.h        = opt.container.height();
      
      opt.dragItemInitialHeight       = opt.dragItem.innerHeight();
      opt.dragItemInnerSpacing        = getInnerSpacing(opt.dragItem.get(0));
      opt.dragItemOuterSpacing        = getOuterSpacing(opt.dragItem.get(0));

      // Transform scale
      if (opt.containerScale===false) {opt.containerScale = 1;}
      var toPos = opt.dragStartPosition.y-opt.containerStartPosition.y;
      opt.containerTranslate.y = toPos * (1-opt.containerScale);
      if (opt.containerScale!==1) {
        opt.container.css('transform-origin', 'center top');
        opt.container.css('transform', 'translate3d(0,'+opt.containerTranslate.y+'px,0) scale('+opt.containerScale+')');
      }

      // Constrain dragItem height animated
      (function constrainDragItemToMaxHeight() {
        var dragItemBareHeight          = opt.dragItemInitialHeight -opt.dragItemInnerSpacing.y();
        var dragItemBareHeightLimited   = opt.dragItemMaxHeight     -opt.dragItemInnerSpacing.y();
  
        // On animation, Safari assumes a default max-height of 0. We do not want animate that.
        // Preserve other transition values to not interfere with opt.dragItemClass animations
        var transition = getComputedStyleValues(opt.dragItem.get(0))('transition');
        transition = transition.replace(/(,? ?)(max-height [\w\s\.]+([\w-]+\([\w\s\.,]+\))?[\w\s\.]*)(,? ?)/i, function (all,c1,m,es,c2) {
          return c1+"max-height 0s"+c2;
          return c1.length && c2.length ? c1 : "";
        });
        if (!transition.length) transition = "none";
        opt.dragItem.css('transition', transition);
        setTimeout(function() {
  
          // Animate from initial height
          opt.dragItem.css('max-height', dragItemBareHeight+'px');
  
          setTimeout(function() {
            opt.dragItem.css('transition', '');
            setTimeout(function() {
              if (!opt.dragItem) {return;} // If just a click, dragEnd could be called before timeout
  
              // Animate to constrained height
              opt.dragItem.css('max-height', dragItemBareHeightLimited+'px');

            }, 10);
          }, 10);
        }, 10);
      })();

      // Add dragItemTransformStyle
      if (opt.dragItemTransformStyle)
        opt.dragItem.css('transform', opt.dragItemTransformStyle);

      // Auto scroll
      if (opt.scrollDistance) 
        opt.scrollIntervalId = setInterval(autoScroll, 50);

      // Notify
      opt.dragStart(opt);
    };

    var dragMove = function (absolutePosition) {

      // Limit dragItem's absolute position to container bounds
      var dragLimit     = {min:{x:0,y:0}, max:{x:0,y:0}};
      dragLimit.min.y   = opt.scrollContainerPosition.y+opt.containerStartPosition.y;
      dragLimit.min.y  += opt.handleMargin.y*opt.containerScale;
      dragLimit.min.y  += opt.containerTranslate.y;
      dragLimit.max.y   = opt.containerStartPosition.y;
      dragLimit.max.y  += opt.containerStartSize.h*opt.containerScale; // container bottom position
      dragLimit.max.y  += opt.containerTranslate.y; // vv minus height of dragItem from drag position
      dragLimit.max.y  -= (opt.dragItemInitialHeight - opt.handleMargin.y)*opt.containerScale;

      opt.dragAbsolutePosition.x = absolutePosition.x;
      opt.dragAbsolutePosition.y = Math.max(dragLimit.min.y, Math.min(absolutePosition.y, dragLimit.max.y));

      // Calculate delta
      var p   = {x:0,y:0};
      p.x     = opt.dragAbsolutePosition.x  -opt.dragStartPosition.x;
      p.y     = opt.dragAbsolutePosition.y  -opt.dragStartPosition.y;

      // Update values
      var dragItemHeight    = Math.min(opt.dragItemInitialHeight, opt.dragItemMaxHeight);
      var dragItemTop       = opt.containerStartPosition.y; //(container |
      dragItemTop          += opt.dragItem.position().top;  //(container | top
      dragItemTop          += opt.dragItemOuterSpacing.top; //(container | top | margin | border)| padding | height | ...
      dragItemTop          += opt.containerTranslate.y;
      var dragItemMiddle    = dragItemTop+dragItemHeight/2; //(container | top | margin | border | padding | hei)ht | ...

      // Translate move siblings
      function translateSiblings(prev) {
        var item = opt.dragItem;
        var itemHeight, itemTop, itemEdge, translateY, itemOuterSpacing;
        opt.dragDeltaTransform.y = 0;

        // Loop through siblings in moved direction
        while ((item = prev?item.prev(opt.itemSelector):item.next(opt.itemSelector)).length) {

          // Vars
          translateY        = null;
          itemHeight        = item.innerHeight();           // container | top | margin | border |(padding | height)| ...
          itemOuterSpacing  = getOuterSpacing(item.get(0)); // container | top |(margin | border)| padding | height | ...
          itemTop           = item.data('sortTop');

          // Save original position of sibling
          if (itemTop===undefined) {
            var itemOffset = item.offset();                 //(container | top | margin)| border | padding | height | ...
            item.data('sortTop', (itemTop = itemOffset.top));
          }

          // Where to react
          itemEdge  = itemTop;
          itemEdge += itemHeight/2; // Get middle
          itemEdge += dragItemHeight/2 *(prev?1:-1); // Turn on top/bottom (depending on prev)

          // Turn on top/bottom (depending on prev) instead of middle, if item is smaller than dragItem OR ALWAYS
          // itemEdge+= dragItemHeight/2 *(prev?1:-1) *(itemHeight<dragItemHeight*1.2 ||1)

          // Figure out correct translation
          if (prev) {
            translateY = dragItemMiddle < itemEdge ?  1 : null;
          } else {
            translateY = dragItemMiddle > itemEdge ? -1 : null;
          }
          //translateY=null;

          // Save "delta" for later
          if (translateY)
            opt.dragDeltaTransform.y += itemHeight*(translateY);

          // Translate sibling
          var outerSpacingTrans = opt.dragItemOuterSpacing.y();
          outerSpacingTrans    -= translateY<0 ? itemOuterSpacing.top:itemOuterSpacing.bottom;
          var itemTransY        = Math.round(translateY*(dragItemHeight+outerSpacingTrans));
          item.css('transform', translateY?'translate3D(0,'+itemTransY+'px,0)':'');

          // Update virtual index: (testing item index) (if backwards (prev), go after,
          // otherwise go before) (only if translates, not top & bottom)
          opt.dragItemVirtualIndex = getItemIndex(item) +(prev?1:-1)*(!translateY);

          // Break if no need to move sibling(s) anymore
          if (!translateY)
            break;
        }
      }

      // Only if moved in a direction
      if (p.y!==0)
        translateSiblings(p.y<0);

      // Take scale into account
      p.x /= opt.containerScale;
      p.y /= opt.containerScale;

      // Transform move dragItem
      var additionalTransformValues = (opt.dragItemTransformStyle?' '+opt.dragItemTransformStyle:'');
      opt.dragItem.css('transform', 'translate3D(0,'+Math.round(p.y)+'px,0)'+additionalTransformValues);

      // Notify
      opt.dragMove(opt);
    };

    var dragEnd = function () {

      // Stop auto scroll
      if (opt.scrollIntervalId)
        clearInterval(opt.scrollIntervalId);

      // Know if things should be handled with animation
      var putAnimated = opt.shouldPutIntoPlace=='animated';

      // Reset classes
      opt.dragItem.removeClass(opt.dragItemClass);
      opt.container.removeClass(opt.dragActiveClass);

      // Scale back to normal
      if (opt.containerScale!==1&&opt.containerScale!==false) {
        opt.container.css('transform', '');
        //opt.container.css('transform-origin', '');
      }

      // Put into place
      if (opt.shouldPutIntoPlace) {
        var additionalTransformValues = (opt.dragItemTransformStyle?' '+opt.dragItemTransformStyle:'');
        opt.dragItem.css('transform', 'translate3D(0,0px,0)'+additionalTransformValues);
        opt.dragItem.css('transition', 'none');

        opt.putIntoPlace(putAnimated);
      }

      // Calculate the space before dragItem's new position (new abs pos)
      var spaceBeforeY = 0, prevMarginY = 0;
      opt.dragItem.prevAll(opt.itemSelector).each(function(idx, elm) {
        var styles = getComputedStyleValues(elm);
        var mTop = styles("margin-top");
        var mBottom = styles("margin-bottom");
        spaceBeforeY += Math.max(prevMarginY, mTop);
        spaceBeforeY += $(elm).outerHeight();
        prevMarginY = mBottom;
      })
      spaceBeforeY += Math.max(prevMarginY, opt.dragItemOuterSpacing.top);

      // Reset siblings transform
      opt.container.children(opt.itemSelector).each(function (index,item) {
        item = $(item);
        item.removeData('sortTop');

        // If not animated or if animated (but not dragItem)
        if (!putAnimated || !item.is(opt.dragItem)) {
          item.css('transform', '');

        // Else, if animated and dragItem, set relative transform
        } else {
          var itemAbsPosInContainerY = opt.dragAbsolutePosition.y-opt.containerStartPosition.y-opt.handleMargin.y;
          var trans = itemAbsPosInContainerY-spaceBeforeY; // trans so visual pos still same after dom change

          var additionalTransformValues = (opt.dragItemTransformStyle?' '+opt.dragItemTransformStyle:'');
          item.css('transform', 'translate3D(0,'+trans+'px,0)'+additionalTransformValues);
          setTimeout(function () {
            item.css('transition', '');
          }, 1)
        }
      });

      // Remove height constraint
      if (!putAnimated) {
        opt.dragItem.css('max-height', '');
      } else {
        opt.dragItem.addClass('putting-into-place');
        setTimeout(function(dragItem, height) {
          dragItem.css('max-height', height+'px');
          dragItem.css('transform', '');
        }, 10, opt.dragItem, opt.dragItemInitialHeight);
        setTimeout(function(dragItem) {
          dragItem.css('transition', 'none'); // Safari assumes max-height animation to 0, not nice.
          dragItem.css('max-height', '');
          setTimeout(function(dragItem) {
            dragItem.css('transition', '');
            dragItem.removeClass('putting-into-place');
          }, 0, dragItem);
        }, opt.cssResetAnimationDelay, opt.dragItem);

        scrollDragItemIntoViewAnimated(opt.scrollIntoViewDuration);
      }

      // Notify
      opt.dragEnd(opt, opt.dragItem, opt.dragItemOriginalIndex, opt.dragItemVirtualIndex);
      opt.dragItem = null;
      opt.dragItemVirtualIndex = null;
    };


    // Functions

    function getScrollContainerInsideEdge() {
      var top = opt.scrollContainerPosition.y+opt.scrollOffset.y; 
      return {
        top:top,
        bottom:top+opt.scrollContainerSize.h
      }
    }

    function autoScroll() {

      // Vars
      var scrollDelta = {x:0,y:0};
      var scrollContainerEdge = getScrollContainerInsideEdge();
      var insideScrollZone = {
        top:    (opt.scrollDistance+scrollContainerEdge.top) - opt.dragAbsolutePosition.y,
        bottom: opt.dragAbsolutePosition.y - (scrollContainerEdge.bottom-opt.scrollDistance)
      }

      // Faster scroll if closer to the edge
      function scrollDeltaFromScrollDistance(distance) {
        var p = distance/opt.scrollDistance;
        return p*opt.scrollSpeed*2;
      }

      // If insideScrollZone.bottom
      if (insideScrollZone.bottom>0) {
        if (opt.scrollContainerSize.h+opt.scrollOffset.y<opt.containerStartSize.h*opt.containerScale+300)
          scrollDelta.y = scrollDeltaFromScrollDistance(insideScrollZone.bottom);

      // Or if insideScrollZone.top
      } else if (insideScrollZone.top>0) {
        if (opt.scrollOffset.y>0)
          scrollDelta.y = -scrollDeltaFromScrollDistance(insideScrollZone.top);

      // Otherwhise, no auto scroll should be executed
      } else {
        return;
      }

      // Update values
      opt.scrollOffset.y += scrollDelta.y;
      opt.scrollContainer.scrollTop(opt.scrollOffset.y);

      // Stimulate a move, so interface changes
      dragMove({
        x:opt.dragAbsolutePosition.x+scrollDelta.x,
        y:opt.dragAbsolutePosition.y+scrollDelta.y
      });
    }

    // Scroll item visible if put out of vision
    function scrollDragItemIntoViewAnimated(duration) {

      var scrollDeltaAbs      = {x:0,y:0};
      var scrollContainerEdge = getScrollContainerInsideEdge();
      var edgeMargin          = (scrollContainerEdge.bottom-scrollContainerEdge.top)*0.15;

      // Get item's new position
      var pos = {x:0,y:0};
      pos.y   = opt.dragStartPosition.y -opt.dragDeltaTransform.y -opt.handleMargin.y;

      // Get altered scrollOffset
      if ((scrollDeltaAbs.y = scrollContainerEdge.top-pos.y )>0)
        opt.scrollOffset.y -= scrollDeltaAbs.y + edgeMargin;
      else if ((scrollDeltaAbs.y = pos.y+opt.dragItemInitialHeight-scrollContainerEdge.bottom)>0)
        opt.scrollOffset.y += scrollDeltaAbs.y + edgeMargin;

      // Only do the scrolling animation if necessary
      if (scrollDeltaAbs.y<=0)
        return;

      // Get scrollingElement (.animate scrollTop doesn't
      // work on document, but document.scrollingElement)
      var scrollingElement = opt.scrollContainer.get(0).scrollingElement;
      scrollingElement = (typeof scrollingElement === "object") ? $(scrollingElement):opt.scrollContainer;
      scrollingElement.animate({
        scrollTop: opt.scrollOffset.y
      }, duration);
    }

    // Returns the item's index in the list of items (a subset of
    // opt.container's children defined by the opt.itemSelector).
    // Usually the same as item.index(), but sometimes different.
    function getItemIndex(item) {
      var item = item.get(0);
      var children = opt.container.children(opt.itemSelector);
      var index = -1;
      children.each(function (i, child) {
        if (child===item) {
          index = i;
          return false;
        }
      })
      return index;
    }

    opt.putIntoPlace = function (animated) {
      var fromIndex = opt.dragItemOriginalIndex;
      var toIndex   = opt.dragItemVirtualIndex;
      var children  = opt.container.children(opt.itemSelector);

      // If click w/o move, no virtual index will be set
      // or toIndex same as fromIndex, no DOM change necessary
      if (toIndex===null || toIndex===fromIndex)
        return;

      // Make the DOM change
      if (toIndex===0) {
        opt.dragItem.insertBefore(children[0]);
      } else if (toIndex>=children.length) {
        opt.dragItem.insertAfter(children[children.length-1]);
      } else {
        opt.dragItem.insertAfter(children[toIndex-(toIndex<fromIndex?1:0)]);
      }
    }

    function addDefaultCssForList(should) {
      if (!should) {return;}
      if (should=='auto') {
        var anItem = opt.container.get(0).querySelector(opt.itemSelector);
        var value = getComputedStyleValues(anItem)('transition')
        if (value && value != "all 0s ease 0s") return;
      }
      if (opt.containerDefaultStyleClass) {return;}
      
      opt.containerDefaultStyleClass = 'smoothSortDefaultStyle'+Math.round(Math.random()*1000);
      opt.container.addClass(opt.containerDefaultStyleClass);

      var cssTxt = "";
      cssTxt += "UL LI {position:relative;transition:maxHeightTrans;}";
      cssTxt += "UL.DRAG-ACTIVE LI:not(.MOVING) {transition:transformTrans;}";
      cssTxt += "UL LI.MOVING {z-index:100;overflow-y:hidden;}";
      cssTxt += "UL LI.PUTTING-INTO-PLACE {z-index:100;transition:maxHeightTrans, transformTrans;}";
      cssTxt += "UL LI HANDLE {cursor:-webkit-grab;cursor:grab;}";
      cssTxt += "UL LI HANDLE:active, UL LI.MOVING HANDLE {cursor:-webkit-grabbing;cursor:grabbing;}";
    
      cssTxt = cssTxt.replace(/UL/g, "."+opt.containerDefaultStyleClass);
      cssTxt = cssTxt.replace(/LI/g, opt.itemSelector);
      cssTxt = cssTxt.replace(/MOVING/g, opt.dragItemClass);
      cssTxt = cssTxt.replace(/DRAG-ACTIVE/g, opt.dragActiveClass);
      cssTxt = cssTxt.replace(/PUTTING-INTO-PLACE/g, 'putting-into-place');
      cssTxt = cssTxt.replace(/HANDLE/g, opt.handleSelector);

      var maxHeightTrans = "max-height "+Math.round(opt.cssResetAnimationDelay)+"ms";
      cssTxt = cssTxt.replace(/maxHeightTrans/g, maxHeightTrans);
      var transformTrans = "transform "+Math.round(opt.cssResetAnimationDelay*0.55)+"ms ease-out";
      cssTxt = cssTxt.replace(/transformTrans/g, transformTrans);
      
      var head = $('head');
      if (!head) {return console.log("smoothSort addDefaultCssForList: No head?");}
    
      head.prepend('<style>'+cssTxt+'</style>');
    }


    // Helper

    function getMousePosition(e) {

      // Different browsers
      // - same values
      var p = {x:0,y:0};
      if (e.pageX || e.pageY) {
        p.x=e.pageX;
        p.y=e.pageY;
      } else if (e.clientX || e.clientY)  {
        p.x = e.clientX;
        p.y = e.clientY;
        p.x += document.body.scrollLeft;
        p.y += document.body.scrollTop;
        p.x += document.documentElement.scrollLeft;
        p.y += document.documentElement.scrollTop;
      }

      return p;
    }

    function getOffsetToParent(el, parent) {
      var offset = {x:0,y:0};
      while ( el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop) ) {
        offset.x += el.offsetLeft - el.scrollLeft;
        offset.y += el.offsetTop - el.scrollTop;
        if (parent=== (el = el.offsetParent) )
          break;
      }
      return offset;
    }

    // Use eg.: var el = document.body
    // getComputedStyleValue(el)("margin-left") -> 10
    function getComputedStyleValues(el) {
      var getPropertyValue;
      if (document.defaultView && document.defaultView.getComputedStyle) {
        var styles = document.defaultView.getComputedStyle(el, "");
        getPropertyValue = function (prop) {
          return styles.getPropertyValue(prop);
        };
      } else if (el.currentStyle) {
        getPropertyValue = function (prop) {
          prop = prop.replace(/\-(\w)/g, function (match, group1) {
            return group1.toUpperCase();
          });
          return el.currentStyle[prop];
        };
      } else return console.log("In getComputedStyleValue: No browser support");

      return function (prop) {
        var val = getPropertyValue(prop);
        var matches = val.match(/^([\d\.]+)(px|s|ms|em)?$/);
        if (matches&&matches[1]!==undefined) {
          val = parseFloat(matches[1], 10)
          if (matches[2]=="em") {
            console.log("Use of em in getComputedStyleValue(",el,property,"), multiplying with 16");
            val *= 16;
          }
        }
        return val;
      };
    }

    function getOuterSpacing(el) {
      var ret = {left:0,right:0,top:0,bottom:0};
      ret.y = function(){return this.top+this.bottom;};
      ret.x = function(){return this.left+this.right;};
      if (!el) return ret;
      var styles = getComputedStyleValues(el);
      ret.top    = styles('margin-top')    + styles('border-top-width'); 
      ret.bottom = styles('margin-bottom') + styles('border-bottom-width');
      ret.left   = styles('margin-left')   + styles('border-left-width'); 
      ret.right  = styles('margin-right')  + styles('border-right-width');
      return ret;
    }
    function getInnerSpacing(el) {
      var ret = getOuterSpacing();
      if (!el) return ret;
      var styles = getComputedStyleValues(el);
      ret.top    = styles('padding-top');
      ret.bottom = styles('padding-bottom');
      ret.left   = styles('padding-left');
      ret.right  = styles('padding-right');
      return ret;
    }

    function getItemFromHandle(p) {

      // Drag handle is inside
      while (p&&!p.is(opt.itemSelector)) {
        p = p.parent();
      }

      return p&&p.is(opt.itemSelector)?p:null;
    }


    // Bind events

    $(opt.container).on('mousedown', opt.itemSelector+' '+opt.handleSelector, function (e) {
      var item = getItemFromHandle($(this));
      if (!item) return;

      opt.handleMargin = {
        x:e.offsetX,
        y:e.offsetY
      };

      e.preventDefault();
      var p = getMousePosition(e);
      dragStart(item, p);
    });

    $(document).mousemove(function (e) {
      if (!opt.dragItem)
        return;

      e.preventDefault();
      var p = getMousePosition(e);
      dragMove(p);
    });

    $(opt.scrollContainer).scroll(function () {
      if (!opt.dragItem)
        return;

      // Update values
      var scrollDelta = {
        x:-opt.scrollOffset.x + ( opt.scrollOffset.x = opt.scrollContainer.scrollLeft() ),
        y:-opt.scrollOffset.y + ( opt.scrollOffset.y = opt.scrollContainer.scrollTop() )
      };

      // Stimulate a move, so interface changes
      dragMove({
        x:opt.dragAbsolutePosition.x+scrollDelta.x,
        y:opt.dragAbsolutePosition.y+scrollDelta.y
      });
    });

    $(document).mouseup(function () {
      if (opt.dragItem)
        dragEnd();
    });

    opt.iDragStart = dragStart;
    opt.iDragEnd = dragEnd;
    opt.iDragMove = dragMove;

    opt.didInit(opt);

    // Done

    return this;
  };
}(jQuery));