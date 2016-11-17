function Editor() {
  var content = document.querySelector('.mirror-code')

  this.update = function(){
    var cursor = document.querySelector('.cursor');
    cursor.classList.remove('animate');

    content.focus()

    var text = document.querySelector('.code');
    text.innerHTML = Prism.highlight(content.value, Prism.languages.javascript);

    setTimeout(function() {
      window.scrollTo(0, text.offsetHeight);
      setTimeout(function(){
        cursor.classList.add('animate');
      }, 400);
    }, 20);
  }

  this.newTab = function(filename, data) {
    content.value = data;
    this.update();
  }
}
var editor = new Editor();

// key("a", function() {console.log(1)})

document.addEventListener("DOMContentLoaded", function(event) {
    var mirror = document.querySelector('.mirror-code');

    mirror.value = "var a = 'Hi, this retro.'; \n" +
    "document.body.addEventListener('keydown', function(event) {\n" +
    "   var text = document.querySelector('.text');\n" +
    "   text.textContent = text.textContent + event.key;\n" +
    "});";
    mirror.focus()


    function updateScreen() {
      mirror.focus();
    }

    document.body.addEventListener('keyup', () => { updateScreen() })
    document.body.addEventListener('keydown', () => { updateScreen() })
    editor.update()
    mirror.addEventListener('input', editor.update.bind(this))
});


document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

document.body.ondrop = (ev) => {
  var filepath = ev.dataTransfer.files[0].path;
  var fs = require('fs');
  console.log(filepath)
  fs.readFile(filepath, 'utf8', function (err, data) {
    if (err) {
      return console.log(err);
    }
    editor.newTab(filepath, data);
  });
  ev.preventDefault()
}
