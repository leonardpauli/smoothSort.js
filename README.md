# smoothSort.js
*Adds smooth drag-n-drop sorting to any HTML list with a simple call.*
Currently requires jQuery, and some css.


## Quick start

1. Load jQuery.js
-  Load custom css (including specific rules for smoothSort lists)  
   (eg. `ul.drag-active li.moving .handle:active, li.putting-into-place`)
-  Load smoothSort.js
-  Setup a list (eg. `<ul><li>Item <b class="handle">drag me</b></li></ul>`)
2. Invoke smoothSort
```javascript
$('ul').smoothSort({
  containerScale:1,
  dragEnd: function (item, fromIndex, toIndex) {
    console.log('Drag ended', item, fromIndex, toIndex)
  }
});
```
6. Profit.


## Usage

See the first sections in the code for
- Options
- Events
- Callable functions
- Read only variables

```javascript
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
  dragItemMaxHeight:100, // px
  dragItemClass:'moving',
  handleSelector:'.handle',
  shouldPutIntoPlace:'animated', // true | false | 'animated'
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
```


In event handlers, especially the following could be useful:
- this.dragItem
- this.dragItemOriginalIndex (fromIndex)
- this.dragItemVirtualIndex (toIndex)


## Features

- Adds drag-n-drop sorting functionality
- Autoscrolls dynamically when cursor gets close(r) to an edge
- Manual scrolling while dragging, and autoscrolling, works simultaneously
- Autoscrolls dropped item into view if put outside
- Leaves no traces in the DOM when not activly in use
- Items collapses to a max-height when dragged, if wanted (dragItemMaxHeight)
- Highly customisable
  - Structure-wise (container, scrolling container, item and handle can have multiple elements around and in-between)
  - Style-wise (custom animations, timings, classes, basically everything)
  - Action-wise (dragStart/Move/End/didInit; handlers for your code to thrive)
  - Master-wise (clean and commented code)
- Does things smoothly.


## Todo

- When scaled, height-scaledHeight... get top offset and use
- Rework away jQuery dependency.
- Bower
- Ember..?
- Possible padding issue when applied to scrollContainer, affecting switch edge

---

Feel free to contribute, and to open issues/requests.

Originally created by Leonard Pauli  
Copyright © Leonard Pauli 2015-2016  

Date: 17/3-2015  
Rework: 20/2-2016  
License: MIT  