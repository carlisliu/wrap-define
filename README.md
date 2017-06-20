# wrap-define

## Usage

In a browser:
```html
<html>
<head>
    <title>define</title>
    <script type="text/javascript" src="dist/bundle.js"></script>
    <script type="text/javascript" src="//cdn.bootcss.com/require.js/2.3.2/require.js"></script>
</head>
<body>
    <h1>hi, there</h1>
    <script type="text/javascript">
        window.addEventListener('error', function (e) {
            console.log('error module is:', e.error && e.error.moduleId);
        });
    </script>
    <script type="text/javascript">
        define('preload', [], function () {
            //throw new Error('preload error');
            console.log('preload');
        });
        define('load', ['preload'], function () {
            //throw new Error('load error');
            window.addEventListener('click', function (e) {
                throw new Error('click error');
            });
            console.log('load');
        });

        define('last', [], function () {
            console.log('last');
        });

        require(['load']);
        //require(['last']);
    </script>
</body>
</html>
```
