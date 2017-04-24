ace.define("ace/snippets/maze",["require","exports","module"], (require, exports, module) => {
    exports.snippetText = "snippet >\n\
    description assignment\n\
    scope maze\n\
        -> ${1}= ${2}\n\
    \n\
    snippet >\n\
    description if\n\
    scope maze\n\
        -> IF ${2:**} THEN %${3:L} ELSE %${4:R}\n\
    ";
    exports.scope = "maze";
});
