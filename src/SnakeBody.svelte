<script>
  export let top = unit;
  export let left = unit;
  export let isHead = false;
  export let direction = "right";
</script>

<style>
  .snake-body {
    background-color: #00DDDD;
    border: #00DDDD 1px solid;
    position: absolute;
    width: 48px;
    height: 48px;
    z-index: 3;
  }
  .eyes {
    position: absolute;
    background-color: #ADFF2F;
    border: green 1px solid;
    border-radius: 50%;
    width: 20%;
    height: 20%;
  }
  .mouth{
    position: absolute;
    background-color: black;
    border-radius: 30%;
    width: 20%;
    height: 80%;
  }
  .pupils {
    position: absolute;
    background-color: black;
    border-radius: 50%;
    width: 5%;
    height: 5%;
  }
  #leftEye {
    left: 50%;
    top: 25%;
  }
  #rightEye {
    left: 50%;
    bottom: 25%;
  }
  #leftPupil {
    left: 63%;
    top: 33%;
  }
  #rightPupil {
    left: 63%;
    bottom: 33%;
  }
  #mouth {
    left: 80%;
    top: 10%;
  }
  .snake-body.right {
    transform: rotate(0deg);
  }
  .snake-body.left {
    transform: rotate(180deg);
  }
  .snake-body.up {
    transform: rotate(270deg);
  }
  .snake-body.down {
    transform: rotate(90deg);
  }
</style>

<div class="snake-body {direction}" style="left: {left}px; top: {top}px;">
  {#if isHead}
    <div id="leftEye" class="eyes" />
    <div id="rightEye" class="eyes" />
    <div id="leftPupil" class="pupils" />
    <div id="rightPupil" class="pupils" />
    <div id="mouth" class="mouth" />
  {/if}
</div>
