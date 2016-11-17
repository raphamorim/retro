function Editor() {
  this.update = function(){
    var cursor = document.querySelector('.cursor');
    cursor.classList.remove('animate');

    var mirror = document.querySelector('.mirror-code')
    mirror.focus()
    console.log(mirror.value)

    var text = document.querySelector('.code');
    text.innerHTML = Prism.highlight(mirror.value, Prism.languages.javascript);
    setTimeout(function(){
      cursor.classList.add('animate');
    }, 400);
  }
}
var editor = new Editor();

// key("a", function() {console.log(1)})

document.addEventListener("DOMContentLoaded", function(event) {
    var mirror = document.querySelector('.mirror-code')

    mirror.value = "var a = 'Hi, this retro.'; \n" +
    "document.body.addEventListener('keydown', function(event) {\n" +
    "   var text = document.querySelector('.text');\n" +
    "   text.textContent = text.textContent + event.key;\n" +
    "});";
    mirror.focus()

    document.body.addEventListener('keyup', () => { mirror.focus })
    document.body.addEventListener('keydown', () => { mirror.focus })
    editor.update()
    mirror.addEventListener('input', editor.update.bind(this))
});
