<script>
  export let food1Top;
  export let food1Left;
  export let food2Top;
  export let food2Left;
</script>

<style>
  .food1, .food2 {
    width: 48px;
    height: 48px;
    position: absolute;
    border: solid black 1px;
    z-index: 0;
  }
  .food1{
    background-color: #0055FF;
    border-radius: 50%;
  }
  .food2{
    background-color: #FF5500;
    border-radius: 5%;
  }
</style>

<div class="food1" style="left: {food1Left}px; top: {food1Top}px"/>
<div class="food2" style="left: {food2Left}px; top: {food2Top}px"/>