function themeSnow() {
    function addSnow() {
        var snow = document.createElement("div")
        snow.innerHTML = `<img src="../../../otherimg/snow${Math.floor(Math.random() * 4) + 1}.png">`
        snow.className = "snow"
        snow.style.left = `${Math.random() * 100}%`
        snow.style.bottom = `${Math.random() * 100}%`
        snow.style.width = `${Math.random() * 4}%`
        snow.style.rotate = `${Math.random() * 360}deg`
        snow.style.transform = `rotate3d(${Math.random()}, ${Math.random()}, ${Math.random()}, ${Math.random() * 360}deg)`
        snow.style.filter = `blur(${Math.random() * 2}px)`
        const tar = document.getElementsByClassName("snow-box")[0]
        tar.appendChild(snow)
    }
    var sum = Math.floor(Math.random() * 100) + 50
    while (sum--) {
        addSnow()
    }
}