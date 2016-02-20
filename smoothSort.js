/* smoothSort.js
Adds smooth drag-n-drop sorting to any HTML list with a simple call.
Currently requires jQuery, and some css.

Originally created by Leonard Pauli
Copyright © Leonard Pauli 2015-2016

Date: 17/3-2015
Rework: 20/2-2016
License: MIT
*/

/* Todo:
 - When scaled, height-scaledHeight... get top offset and use
 - Manual scroll while draging should work
 - In getItemIndex, return the index within "opt.container.children(opt.itemSelector)" and not just all children
 - Rework away jQuery dependency.
 - Readme
 - GitHub
 - Bower
 - Ember..?
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
      dragEnd: function (item, fromIndex, toIndex) {
        console.log('Drag ended', item, fromIndex, toIndex)
      }
    });
  3. Profit.
*/



(function ($) {
  $.fn.smoothSort = function(options) {

    // Options
    var opt = $.extend({
      container:$(this),
      containerScale:1,
      dragActiveClass:'drag-active',
      scrollContainer:$(this).parent(),
      scrollDistance:100, // distance from top/bottom of scrollContainer, to activate autoScroll
      scrollSpeed:10,
      itemSelector:'li',
      dragItemMaxHeight:100,
      dragItemClass:'moving',
      handleSelector:'.handle',
      handleTopMargin:20,
      shouldPutIntoPlace:'animated', // true,false,'animated'
      cssResetAnimationDelay:700, // if you got css like
      // li.putting-into-place {transition:max-height 700ms, transform 0.23s ease-out;}
      // then set to longest duration (in this case 700ms)

      // Events
      dragStart:function () {},
      dragMove:function () {},
      dragEnd:function (item, fromIndex, toIndex) {},
      didInit:function () {}
    }, options);

    // Callable functions
    // (defined in "Functions" section)
    opt.putIntoPlace = null;
    
    // Read only variables
    opt.dragItem = null;
    opt.dragStartPosition       = { x:0, y:0 };
    opt.dragAbsolutePosition    = { x:0, y:0 };
    opt.dragDeltaTransform      = { x:0, y:0 };
    opt.dragItemInitialHeight   = 0;
    opt.dragItemOriginalIndex   = null;
    opt.dragItemVirtualIndex    = null;

    opt.containerStartPosition  = { x:0, y:0 };
    opt.containerStartSize      = { w:0, h:0 };
    
    opt.scrollOffset            = { x:0, y:0 };
    opt.scrollContainerPosition = { x:0, y:0 };
    opt.scrollContainerSize     = { w:0, h:0 };
    opt.scrollIntervalId        = null;


    // Events

    var dragStart = function (dragItem, p) {
      opt.dragItem = dragItem;
      opt.dragStartPosition = {x:p.x,y:p.y};
      opt.dragAbsolutePosition = {x:p.x,y:p.y};
      opt.dragDeltaTransform = {x:0,y:0};
      opt.dragItemOriginalIndex = getItemIndex(opt.dragItem);

      opt.container.addClass(opt.dragActiveClass);
      opt.dragItem.addClass(opt.dragItemClass);

      // Update values
      opt.scrollOffset.x = opt.scrollContainer.scrollLeft();
      opt.scrollOffset.y = opt.scrollContainer.scrollTop();

      var containerOffset = opt.scrollContainer.offset();
      opt.scrollContainerPosition.x = containerOffset.left;
      opt.scrollContainerPosition.y = containerOffset.top;
      opt.scrollContainerSize.w = opt.scrollContainer.width();
      opt.scrollContainerSize.h = opt.scrollContainer.height();
      opt.scrollContainerSize.h = Math.min(opt.scrollContainerSize.h, document.body.clientHeight - opt.scrollContainerPosition.y);
      
      containerOffset = opt.container.offset();
      opt.containerStartPosition.x = containerOffset.left;
      opt.containerStartPosition.y = containerOffset.top;
      opt.containerStartSize.w = opt.container.width();
      opt.containerStartSize.h = opt.container.height();
      
      // Transform scale
      if (opt.containerScale!==1&&opt.containerScale!==false) {
        opt.container.css('transform-origin', 'center '+opt.dragStartPosition.y+'px');
        opt.container.css('transform', 'scale('+opt.containerScale+', '+opt.containerScale+')');
      }
      
      // Constrain dragItem height
      opt.dragItemInitialHeight = opt.dragItem.height();
      opt.dragItem.css('max-height', opt.dragItemInitialHeight);
      setTimeout(function() {
        // If just a click, dragEnd could be called before timeout
        if (!opt.dragItem) return;
        // Animate constrained height
        opt.dragItem.css('max-height', opt.dragItemMaxHeight);
      }, 0);
      
      // Auto scroll
      opt.scrollIntervalId = setInterval(autoScroll, 50);

      // Notify
      opt.dragStart();
    };

    var dragMove = function (absolutePosition) {
      opt.dragAbsolutePosition.x = absolutePosition.x;
      opt.dragAbsolutePosition.y = Math.min(absolutePosition.y, opt.containerStartSize.h-opt.dragItemInitialHeight);
      opt.dragAbsolutePosition.y = Math.max(opt.dragAbsolutePosition.y, opt.scrollContainerPosition.y+opt.handleTopMargin);

      var p = {};
      p.x = opt.dragAbsolutePosition.x-opt.dragStartPosition.x;
      p.y = opt.dragAbsolutePosition.y-opt.dragStartPosition.y;
      
      // Update values
      var dragItemHeight = Math.min(opt.dragItemInitialHeight, opt.dragItemMaxHeight);
      var dragItemTop = opt.dragItem.position().top;
          //console.log(opt.containerScale, dragItemTop);
      var dragItemMiddle = dragItemTop+dragItemHeight/2;

      // Translate move siblings
      function translateSiblings(prev) {
        var item = opt.dragItem;
        var itemHeight, itemTop, itemEdge, translateY, hadSortTop;
        opt.dragDeltaTransform.y = 0;

        // Loop through siblings in moved direction
        while ((item = prev?item.prev(opt.itemSelector):item.next(opt.itemSelector)).length) {

          // Vars
          translateY = null;
          itemHeight = item.height();
          hadSortTop = item.data('sortTop');
          itemTop = hadSortTop===undefined?null:hadSortTop*1;

          // Save original position of sibling
          if (itemTop===null) {
            var itemOffset = item.offset();
            item.data('sortTop', (itemTop = itemOffset.top));
          }

          // Where to react
          itemEdge = itemTop
          itemEdge+= itemHeight/2; // Get middle
          // Turn on top/bottom (depending on prev) instead of middle, if item is smaller than dragItem OR ALWAYS
          itemEdge+= dragItemHeight/2 *(prev?1:-1) *(itemHeight<dragItemHeight*1.2 ||1)

          // Figure out correct translation
          if (prev) {
            translateY = dragItemMiddle < itemEdge ?  1 : null;
          } else {
            translateY = dragItemMiddle > itemEdge ? -1 : null;
          }

          // Save "delta" for later
          if (translateY)
            opt.dragDeltaTransform.y += itemHeight*(translateY);
      
          // Translate sibling
          item.css('transform', translateY?'translate3D(0,'+Math.round(translateY*(dragItemHeight+1))+'px,0)':'');

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
      if (opt.containerScale!==1&&opt.containerScale!==false) {
        p.x /= opt.containerScale;
        p.y /= opt.containerScale;
      }
      
      // Transform move dragItem
      opt.dragItem.css('transform', 'translate3D(0,'+Math.round(p.y)+'px,0)');

      // Notify
      opt.dragMove();
    };

    var dragEnd = function () {
      
      // Stop auto scroll
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
      
      // Reset siblings transform
      //opt.dragItem.css('transform', '');
      opt.container.children(opt.itemSelector).each(function (index,item) {
        item = $(item);
        item.removeData('sortTop');

        // If not animated or if animated (but not dragItem)
        if (!putAnimated || !item.is(opt.dragItem)) {
          item.css('transform', '');

        // Else, if animated and dragItem, set relative transform
        } else {
          var trans = opt.dragAbsolutePosition.y-opt.dragStartPosition.y+opt.dragDeltaTransform.y;
          item.css('transform', 'translate3D(0,'+trans+'px,0)');
        }

      });

      // Put into place if ordered
      if (opt.shouldPutIntoPlace) {
        opt.putIntoPlace(putAnimated);
      }
      
      // Remove height constraint
      if (!putAnimated) {
        opt.dragItem.css('max-height', '');
      } else {
        opt.dragItem.addClass('putting-into-place');
        setTimeout(function(dragItem, height) {
          dragItem.css('max-height', height);
          dragItem.css('transform', '');
        }, 0, opt.dragItem, opt.dragItemInitialHeight);
        setTimeout(function(dragItem) {
          dragItem.css('max-height', '');
          dragItem.removeClass('putting-into-place');
        }, opt.cssResetAnimationDelay, opt.dragItem);
      }

      // Notify
      opt.dragEnd(opt.dragItem, opt.dragItemOriginalIndex, opt.dragItemVirtualIndex);
      opt.dragItem = null;
      opt.dragItemVirtualIndex = null;
    };
    

    // Functions

    function autoScroll() {   

      // Vars   
      var scrollDelta = {x:0,y:0};
      var scrollContainerInsideBottom = opt.scrollContainerPosition.y+opt.scrollContainerSize.h+opt.scrollOffset.y;
      var scrollContainerInsideTop = opt.scrollContainerPosition.y+opt.scrollOffset.y;
      
      var insideScrollZoneBottom = (opt.dragAbsolutePosition.y+opt.scrollDistance)-scrollContainerInsideBottom;
      var insideScrollZoneTop = (opt.scrollDistance+scrollContainerInsideTop)-opt.dragAbsolutePosition.y;
      
      // Faster scroll if closer to the edge
      function scrollDeltaFromScrollDistance(distance) {
        var p = distance/opt.scrollDistance;
        return p*opt.scrollSpeed*2;
      }
      
      // If insideScrollZoneBottom
      if (insideScrollZoneBottom>0) {
        if (opt.scrollContainerSize.h+opt.scrollOffset.y<opt.containerStartSize.h*opt.containerScale)
          scrollDelta.y = scrollDeltaFromScrollDistance(insideScrollZoneBottom);

      // Or if insideScrollZoneTop
      } else if (insideScrollZoneTop>0) {
        if (opt.scrollOffset.y>0)
          scrollDelta.y = -scrollDeltaFromScrollDistance(insideScrollZoneTop);

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

    function getItemIndex(item) {
      //var children = opt.container.children(opt.itemSelector)
      return item.index();
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

    $(document).mouseup(function () {
      if (opt.dragItem)
        dragEnd();
    });

    opt.iDragStart = dragStart;
    opt.iDragEnd = dragEnd;
    opt.iDragMove = dragMove;

    opt.didInit();
 
    // Done

    return this;
  };
}(jQuery));