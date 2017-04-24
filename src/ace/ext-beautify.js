ace.define("ace/ext/beautify/php_rules",["require","exports","module","ace/token_iterator"], (require, exports, module) => {
    const TokenIterator = require("ace/token_iterator").TokenIterator;
    exports.newLines = [{
        type: 'support.php_tag',
        value: '<?php'
    }, {
        type: 'support.php_tag',
        value: '<?'
    }, {
        type: 'support.php_tag',
        value: '?>'
    }, {
        type: 'paren.lparen',
        value: '{',
        indent: true
    }, {
        type: 'paren.rparen',
        breakBefore: true,
        value: '}',
        indent: false
    }, {
        type: 'paren.rparen',
        breakBefore: true,
        value: '})',
        indent: false,
        dontBreak: true
    }, {
        type: 'comment'
    }, {
        type: 'text',
        value: ';'
    }, {
        type: 'text',
        value: ':',
        context: 'php'
    }, {
        type: 'keyword',
        value: 'case',
        indent: true,
        dontBreak: true
    }, {
        type: 'keyword',
        value: 'default',
        indent: true,
        dontBreak: true
    }, {
        type: 'keyword',
        value: 'break',
        indent: false,
        dontBreak: true
    }, {
        type: 'punctuation.doctype.end',
        value: '>'
    }, {
        type: 'meta.tag.punctuation.end',
        value: '>'
    }, {
        type: 'meta.tag.punctuation.begin',
        value: '<',
        blockTag: true,
        indent: true,
        dontBreak: true
    }, {
        type: 'meta.tag.punctuation.begin',
        value: '</',
        indent: false,
        breakBefore: true,
        dontBreak: true
    }, {
        type: 'punctuation.operator',
        value: ';'
    }];

    exports.spaces = [{
        type: 'xml-pe',
        prepend: true
    },{
        type: 'entity.other.attribute-name',
        prepend: true
    }, {
        type: 'storage.type',
        value: 'var',
        append: true
    }, {
        type: 'storage.type',
        value: 'function',
        append: true
    }, {
        type: 'keyword.operator',
        value: '='
    }, {
        type: 'keyword',
        value: 'as',
        prepend: true,
        append: true
    }, {
        type: 'keyword',
        value: 'function',
        append: true
    }, {
        type: 'support.function',
        next: /[^\(]/,
        append: true
    }, {
        type: 'keyword',
        value: 'or',
        append: true,
        prepend: true
    }, {
        type: 'keyword',
        value: 'and',
        append: true,
        prepend: true
    }, {
        type: 'keyword',
        value: 'case',
        append: true
    }, {
        type: 'keyword.operator',
        value: '||',
        append: true,
        prepend: true
    }, {
        type: 'keyword.operator',
        value: '&&',
        append: true,
        prepend: true
    }];
    exports.singleTags = ['!doctype','area','base','br','hr','input','img','link','meta'];

    exports.transform = (iterator, maxPos, context) => {
        let token = iterator.getCurrentToken();
        
        const newLines = exports.newLines;
        const spaces = exports.spaces;
        const singleTags = exports.singleTags;

        let code = '';
        
        let indentation = 0;
        let dontBreak = false;
        let tag;
        let lastTag;
        let lastToken = {};
        let nextTag;
        let nextToken = {};
        let breakAdded = false;
        let value = '';

        while (token!==null) {
            console.log(token);

            if( !token ){
                token = iterator.stepForward();
                continue;
            }
            if( token.type == 'support.php_tag' && token.value != '?>' ){
                context = 'php';
            }
            else if( token.type == 'support.php_tag' && token.value == '?>' ){
                context = 'html';
            }
            else if( token.type == 'meta.tag.name.style' && context != 'css' ){
                context = 'css';
            }
            else if( token.type == 'meta.tag.name.style' && context == 'css' ){
                context = 'html';
            }
            else if( token.type == 'meta.tag.name.script' && context != 'js' ){
                context = 'js';
            }
            else if( token.type == 'meta.tag.name.script' && context == 'js' ){
                context = 'html';
            }

            nextToken = iterator.stepForward();
            if (nextToken && nextToken.type.indexOf('meta.tag.name') == 0) {
                nextTag = nextToken.value;
            }
            if ( lastToken.type == 'support.php_tag' && lastToken.value == '<?=') {
                dontBreak = true;
            }
            if (token.type == 'meta.tag.name') {
                token.value = token.value.toLowerCase();
            }
            if (token.type == 'text') {
                token.value = token.value.trim();
            }
            if (!token.value) {
                token = nextToken;
                continue;
            }
            value = token.value;
            for (var i in spaces) {
                if (
                    token.type == spaces[i].type &&
                    (!spaces[i].value || token.value == spaces[i].value) &&
                    (
                        nextToken &&
                        (!spaces[i].next || spaces[i].next.test(nextToken.value))
                    )
                ) {
                    if (spaces[i].prepend) {
                        value = ` ${token.value}`;
                    }

                    if (spaces[i].append) {
                        value += ' ';
                    }
                }
            }
            if (token.type.indexOf('meta.tag.name') == 0) {
                tag = token.value;
            }
            breakAdded = false;
            for (i in newLines) {
                if (
                    token.type == newLines[i].type &&
                    (
                        !newLines[i].value ||
                        token.value == newLines[i].value
                    ) &&
                    (
                        !newLines[i].blockTag ||
                        !singleTags.includes(nextTag)
                    ) &&
                    (
                        !newLines[i].context ||
                        newLines[i].context === context
                    )
                ) {
                    if (newLines[i].indent === false) {
                        indentation--;
                    }

                    if (
                        newLines[i].breakBefore &&
                        ( !newLines[i].prev || newLines[i].prev.test(lastToken.value) )
                    ) {
                        code += "\n";
                        breakAdded = true;
                        for (i = 0; i < indentation; i++) {
                            code += "\t";
                        }
                    }

                    break;
                }
            }

            if (dontBreak===false) {
                for (i in newLines) {
                    if (
                        lastToken.type == newLines[i].type &&
                        (
                            !newLines[i].value || lastToken.value == newLines[i].value
                        ) &&
                        (
                            !newLines[i].blockTag ||
                            !singleTags.includes(tag)
                        ) &&
                        (
                            !newLines[i].context ||
                            newLines[i].context === context
                        )
                    ) {
                        if (newLines[i].indent === true) {
                            indentation++;
                        }

                        if (!newLines[i].dontBreak  && !breakAdded) {
                            code += "\n";
                            for (i = 0; i < indentation; i++) {
                                code += "\t";
                            }
                        }

                        break;
                    }
                }
            }

            code += value;
            if ( lastToken.type == 'support.php_tag' && lastToken.value == '?>' ) {
                dontBreak = false;
            }
            lastTag = tag;

            lastToken = token;

            token = nextToken;

            if (token===null) {
                break;
            }
        }
        
        return code;
    };
});

ace.define("ace/ext/beautify",["require","exports","module","ace/token_iterator","ace/ext/beautify/php_rules"], (require, exports, module) => {
    const TokenIterator = require("ace/token_iterator").TokenIterator;

    const phpTransform = require("./beautify/php_rules").transform;

    exports.beautify = session => {
        const iterator = new TokenIterator(session, 0, 0);
        const token = iterator.getCurrentToken();

        const context = session.$modeId.split("/").pop();

        const code = phpTransform(iterator, context);
        session.doc.setValue(code);
    };

    exports.commands = [{
        name: "beautify",
        exec(editor) {
            exports.beautify(editor.session);
        },
        bindKey: "Ctrl-Shift-B"
    }]
});
                ((() => {
                    ace.require(["ace/ext/beautify"], () => {});
                }))();
            