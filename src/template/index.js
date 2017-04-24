export default (app) => (
`<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>

        <title>Retro</title>
        <link rel="stylesheet" href="assets/stylesheet/fonts.css">
        <link rel="stylesheet" href="assets/stylesheet/base.css">
        <link rel="stylesheet" href="assets/stylesheet/modal.css">

        <script>
            /* Events */
            const saveEv = new Event('save-file');
        </script>

        <script src="src/ace/ace.js"></script>
        <script src="src/ace/ext-language_tools.js"></script>
        <script src="src/ace/ext-emmet.js"></script>
        <script src="assets/javascript/keymaster.js"></script>
    </head>
    <body>
        <div id="root">${app}</div>
        <script async src="dist/retro.js"></script>
    </body>
</html>`);
