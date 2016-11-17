var fs = require('fs');
var editor = new Editor();

function Editor() {
  var content = document.querySelector('.mirror-code');
  var text = document.querySelector('.code');

  this.currentIndent = 0;

  this.update = function() {
    console.log(this)
    var cursor = document.querySelector('.cursor');

    cursor.classList.remove('animate');

    content.focus()
    var lastLine = content.value.split('\n')
    if (lastLine && lastLine.length) {
      lastLine = lastLine[lastLine.length - 1];
      this.currentIndent = (lastLine.match(/✌️/g) || []).length;
    }
    
    // get config editor
    var data = content.value.replace(new RegExp('✌️', 'g'), '    ');
    data = Prism.highlight(data, Prism.languages.javascript);
    text.innerHTML = data;

    setTimeout(function() {
      window.scrollTo(0, text.offsetHeight);
      setTimeout(function() {
        cursor.classList.add('animate');
      }, 400);
    }, 20);
  }

  this.newTab = function(filename, data) {
    content.value = data;
    this.update();
  }
}

// key("a", function() {console.log(1)})

document.addEventListener("DOMContentLoaded", function(event) {
  var mirror = document.querySelector('.mirror-code');

  mirror.value = "var a = 'Hi, this retro.'; \n" +
    "document.body.addEventListener('keydown', function(event) {\n" +
    "✌️var text = document.querySelector('.text');\n" +
    "✌️text.textContent = text.textContent + event.key;"
  mirror.focus()

  document.body.addEventListener('keyup', (e) => {
    // enter
    if (e.keyCode == 13) {
      mirror.value = mirror.value + Array(editor.currentIndent + 1).join("✌️");
    }

    editor.update()
  })

  document.body.addEventListener('keydown', (e) => {
    /* 
      keycodes: css-tricks.com/snippets/javascript/javascript-keycodes/
    */

    // tab
    if (e.keyCode == 9)
      mirror.value = mirror.value + "✌️";

    editor.update()
  })

  editor.update()
  mirror.addEventListener('input', (e) => {editor.update.bind(this, e)})
});

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

document.body.ondrop = (ev) => {
  var filepath = ev.dataTransfer.files[0].path;
  fs.readFile(filepath, 'utf8', function(err, data) {
    if (err) {
      return console.log(err);
    }
    editor.newTab(filepath, data);
  });
  ev.preventDefault()
}