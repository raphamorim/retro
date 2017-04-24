ace.define("ace/ext/themelist",["require","exports","module","ace/lib/fixoldbrowsers"], (require, exports, module) => {
    require("ace/lib/fixoldbrowsers");

    const themeData = [
        ["Chrome"         ],
        ["Clouds"         ],
        ["Crimson Editor" ],
        ["Dawn"           ],
        ["Dreamweaver"    ],
        ["Eclipse"        ],
        ["GitHub"         ],
        ["IPlastic"       ],
        ["Solarized Light"],
        ["TextMate"       ],
        ["Tomorrow"       ],
        ["XCode"          ],
        ["Kuroir"],
        ["KatzenMilch"],
        ["SQL Server"           ,"sqlserver"               , "light"],
        ["Ambiance"             ,"ambiance"                ,  "dark"],
        ["Chaos"                ,"chaos"                   ,  "dark"],
        ["Clouds Midnight"      ,"clouds_midnight"         ,  "dark"],
        ["Cobalt"               ,"cobalt"                  ,  "dark"],
        ["Gruvbox"              ,"gruvbox"                 ,  "dark"],
        ["idle Fingers"         ,"idle_fingers"            ,  "dark"],
        ["krTheme"              ,"kr_theme"                ,  "dark"],
        ["Merbivore"            ,"merbivore"               ,  "dark"],
        ["Merbivore Soft"       ,"merbivore_soft"          ,  "dark"],
        ["Mono Industrial"      ,"mono_industrial"         ,  "dark"],
        ["Monokai"              ,"monokai"                 ,  "dark"],
        ["Pastel on dark"       ,"pastel_on_dark"          ,  "dark"],
        ["Solarized Dark"       ,"solarized_dark"          ,  "dark"],
        ["Terminal"             ,"terminal"                ,  "dark"],
        ["Tomorrow Night"       ,"tomorrow_night"          ,  "dark"],
        ["Tomorrow Night Blue"  ,"tomorrow_night_blue"     ,  "dark"],
        ["Tomorrow Night Bright","tomorrow_night_bright"   ,  "dark"],
        ["Tomorrow Night 80s"   ,"tomorrow_night_eighties" ,  "dark"],
        ["Twilight"             ,"twilight"                ,  "dark"],
        ["Vibrant Ink"          ,"vibrant_ink"             ,  "dark"]
    ];


    exports.themesByName = {};
    exports.themes = themeData.map(data => {
        const name = data[1] || data[0].replace(/ /g, "_").toLowerCase();
        const theme = {
            caption: data[0],
            theme: `ace/theme/${name}`,
            isDark: data[2] == "dark",
            name
        };
        exports.themesByName[name] = theme;
        return theme;
    });
});
                ((() => {
                    ace.require(["ace/ext/themelist"], () => {});
                }))();
            