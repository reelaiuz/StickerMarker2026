const file=document.getElementById("file");
const canvas=document.getElementById("canvas");
const ctx=canvas.getContext("2d");

document.getElementById("create").onclick=()=>{

if(!file.files.length){
alert("Rasm tanlang");
return;
}

const img=new Image();

img.onload=()=>{

ctx.clearRect(0,0,512,512);

ctx.fillStyle="transparent";
ctx.fillRect(0,0,512,512);

let scale=Math.min(
512/img.width,
512/img.height
);

let w=img.width*scale;
let h=img.height*scale;

let x=(512-w)/2;
let y=(512-h)/2;

ctx.shadowColor="rgba(0,0,0,.4)";
ctx.shadowBlur=20;

ctx.drawImage(img,x,y,w,h);

ctx.lineWidth=12;
ctx.strokeStyle="white";
ctx.strokeRect(x,y,w,h);

};

img.src=URL.createObjectURL(file.files[0]);

};

document.getElementById("download").onclick=()=>{

const a=document.createElement("a");

a.download="sticker.png";

a.href=canvas.toDataURL("image/png");

a.click();

};