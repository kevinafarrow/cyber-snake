<script>
	export let question;
	export let option1;
	export let option2;
</script>

<div class="questionbox">
	<div class="question">{question}</div>
  <div class="legend">
    <div class="food1"/>
	  <div class="option1">{option1}</div>
    <div class="food2"/>
	  <div class="option2">{option2}</div>
  </div>
</div>

<style>
	.questionbox {
		width: 50%;
    height: 200px;
		border: 1px solid #aaa;
		border-radius: 2px;
    position: relative center;
    margin: auto;
		box-shadow: 2px 2px 8px rgba(0,0,0,0.1);
		padding: 1em;
		background-color: #FFFFFF;
		font-family: 'Roboto Mono', monospace;
	}
	.question {
		font-size: 2em;
    text-align: center;
	}
  .option1, .option2 {
		font-size: 1.5em;
  }
	.option1 {
    color: #0055FF;
	}
	.option2 {
    color: #FF5500;
	}
  .food1, .food2 {
    width: 1.5em;
    height: 1.5em;
    position: relative;
    border: solid black 1px;
    z-index: 0;
    margin: .2em
  }
  .food1 {
    background-color: #0055FF;
    border-radius: 50%;
  }
  .food2 {
    background-color: #FF5500;
    border-radius: 5%;
  }
	.legend {
    display: grid;
    grid-template-columns: 1.5em 1fr;
    grid-template-rows: repeat(2, 50%);
    grid-gap: 1.5em;
    margin: 1.5em;
    position: relative center;
  }
</style>