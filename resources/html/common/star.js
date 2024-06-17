
var context;
var arr = new Array();
var starCount = 4000;
var rains = new Array();
var rainCount = 50;

var stars = document.getElementById("stars");
var parentElement = document.getElementsByTagName("body")[0];
function init() {
    stars.width = parentElement.offsetWidth;
    stars.height = parentElement.offsetHeight - 200;
    stars.style.zIndex = 0
    stars.style.position = "fixed"
    stars.style.top = "0px"
    context = stars.getContext("2d");
}

//创建一个星星对象
var Star = function () {
    this.x = parentElement.offsetWidth * Math.random();//横坐标
    this.y = 5000 * Math.random();//纵坐标
    this.text = ".";//文本
    var a = () => Math.ceil(255 - 240 * Math.random());
    //颜色
    this.color = "rgba(" + a() + "," + a() + "," + a() + "," + Math.random() + ")";
    this.getColor = function () {
        this.color = "rgba(" + a() + "," + a() + "," + a() + "," + Math.random() + ")";
    }
    //初始化
    this.init = function () {
        this.getColor();
    }
    //绘制
    this.draw = function () {
        context.fillStyle = this.color;
        context.font = Math.random() * 10 + 5 + "px Georgia";
        context.fillText(this.text, this.x, this.y);
    }
}

//画月亮
function drawMoon() {
    var moon = new Image();
    moon.src = "./images/moon.jpg"
    context.drawImage(moon, -5, -10);
}


//星星闪起来
function playStars() {
    for (var n = 0; n < starCount; n++) {
        arr[n].getColor();
        arr[n].draw();
    }

    setTimeout("playStars()", 100);
}

/*流星雨开始*/
var MeteorRain = function () {
    this.x = -1;
    this.y = -1;
    this.length = -1;//长度
    this.angle = 30; //倾斜角度
    this.width = -1;//宽度
    this.height = -1;//高度
    this.speed = 1;//速度
    this.offset_x = -1;//横轴移动偏移量
    this.offset_y = -1;//纵轴移动偏移量
    this.alpha = 1; //透明度
    this.color1 = "";//流星的色彩
    this.color2 = ""; //流星的色彩
    /*****************获取随机坐标的函数*****************/
    this.getPos = function () //
    {
        //横坐标200--1200
        this.x = Math.random() * parentElement.offsetWidth; //窗口高度
        //纵坐标小于600
        this.y = Math.random() * parentElement.offsetHeight; //窗口宽度
    }
    /**计算两点间的角度*/
    this.countAngle = function (x1, y1, x2, y2) {
        var angle = Math.atan2((y1 - y2), (x1 - x2))
        var theta = angle * (180 / Math.PI);
        return theta;
    }
    /****************初始化函数********************/
    this.init = function () //初始化
    {
        this.getPos();
        this.alpha = 1;//透明度
        this.getRandomColor();
        //最小长度，最大长度
        var x = Math.random() * 1428 * 0.5 + 50;
        this.length = Math.ceil(x);
        // x = Math.random()*10+30;
        this.angle = - this.countAngle(this.x, this.y, parentElement.offsetWidth / 2, parentElement.offsetHeight * 3); //流星倾斜角
        x = Math.random() + 0;
        this.speed = Math.ceil(x); //流星的速度
        var cos = Math.cos(this.angle * 3.14 / 180);
        var sin = Math.sin(this.angle * 3.14 / 180);
        this.width = this.length * cos; //流星所占宽度
        this.height = this.length * sin;//流星所占高度
        this.offset_x = this.speed * cos;
        this.offset_y = this.speed * sin;
    }
    /**************获取随机颜色函数*****************/
    this.getRandomColor = function () {
        var a = () => Math.ceil(255 - 100 * Math.random());
        var color = "rgba(" + a() + "," + a() + "," + a() + ",";
        //中段颜色
        this.color1 = color + Math.random() + ")";
        //结束颜色
        // this.color2 = color + 0 + ")";
        this.color2 = "rgba(" + a() + "," + a() + "," + a() + "," + 0 + ")";
    }
    /***************重新计算流星坐标的函数******************/
    this.countPos = function ()//
    {
        //往左下移动,x减少，y增加
        this.x = this.x - this.offset_x;
        this.y = this.y + this.offset_y;
    }
    /****绘制流星***************************/
    this.draw = function () //绘制一个流星的函数
    {
        context.save();
        context.beginPath();
        context.lineWidth = 3; //宽度
        context.lineCap = 'round';
        context.globalAlpha = this.alpha; //设置透明度
        //创建横向渐变颜色,起点坐标至终点坐标
        var line = context.createLinearGradient(this.x, this.y,
            this.x + this.width,
            this.y - this.height);
        //分段设置颜色
        // line.addColorStop(0, "white");
        line.addColorStop(0, this.color1);
        line.addColorStop(0.3, this.color1);
        line.addColorStop(0.6, this.color2);
        context.strokeStyle = line;
        context.shadowBlur = 10;
        context.shadowColor = this.color1;
        //起点
        context.moveTo(this.x, this.y);
        //终点
        context.lineTo(this.x + this.width, this.y - this.height);
        context.closePath();
        context.stroke();
        context.restore();
    }
    this.move = function () {
        //清空流星像素
        var x = this.x + this.width - this.offset_x;
        var y = this.y - this.height;
        context.clearRect(x - 3, y - 3, this.offset_x + 5, this.offset_y + 5);
        // context.strokeStyle="red";
        // context.strokeRect(x,y-1,this.offset_x+1,this.offset_y+1);
        //重新计算位置，往左下移动
        this.countPos();
        //透明度增加
        this.alpha -= 0.002;
        //重绘
        this.draw();
    }
}

//绘制流星
function playRains() {

    for (var n = 0; n < rainCount; n++) {
        var rain = rains[n];
        rain.move();//移动
        if (rain.y > parentElement.offsetHeight) {//超出界限后重来
            context.clearRect(rain.x, rain.y - rain.height, rain.width, rain.height);
            rains[n] = new MeteorRain();
            rains[n].init();
        }
    }
    setTimeout("playRains()", 2);
}

//页面加载的时候
// window.onload = function () {
init();
//画星星
for (var i = 0; i < starCount; i++) {
    var star = new Star();
    star.init();
    star.draw();
    arr.push(star);
}
//画流星
for (var i = 0; i < rainCount; i++) {
    var rain = new MeteorRain();
    rain.init();
    rain.draw();
    rains.push(rain);
}
// drawMoon();//绘制月亮
// playStars();//绘制闪动的星星
// playRains();//绘制流星

// }
/*流星雨结束*/