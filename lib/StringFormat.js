let Stringformat = function(args) {
    let result = this;
    if (arguments.length > 0) {    
        if (arguments.length == 1 && typeof (args) == "object") {
            for (let key in args) {
                if(args[key]!=undefined){
                    let reg = new RegExp("({" + key + "})", "g");
                    result = result.replace(reg, args[key]);
                }
            }
        }
        else {
            for (let i = 0; i < arguments.length; i++) {
                if (arguments[i] != undefined) {
                    //let reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题
                    let reg = new RegExp("({)" + i + "(})", "g");
                    result = result.replace(reg, arguments[i]);
             }
          }
       }
   }
   return result;
}