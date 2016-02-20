# smoothSort.js
*Adds smooth drag-n-drop sorting to any HTML list with a simple call.*
Currently requires jQuery, and some css.


## Quick start

1. Load jQuery.js
-  Load custom css (including specific rules for smoothSort lists
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
3. Profit.


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
```


In event handlers, especially the following could be usefull:
- this.dragItem
- this.dragItemOriginalIndex (fromIndex)
- this.dragItemVirtualIndex (toIndex)


## Todo:

- When scaled, height-scaledHeight... get top offset and use
- Manual scroll while draging should work
- In getItemIndex, return the index within "opt.container.children(opt.itemSelector)" and not just all children
- Rework away jQuery dependency.
- Readme
- GitHub
- Bower
- Ember..?

## -----

Originally created by Leonard Pauli
Copyright © Leonard Pauli 2015-2016

Date: 17/3-2015
Rework: 20/2-2016
License: MIT