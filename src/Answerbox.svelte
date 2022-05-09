<script>
  export let result;
  export let explanation;
</script>

<div class="answerbox">
  <div class="result">{result}</div>
  <div class="explanation">{explanation}</div>
</div>

<style>
  .answerbox {
    width: 92%;
    height: 250px;
    border: 1px solid #aaa;
		border-radius: 2px;
    position: relative right;
    margin: auto;
		box-shadow: 2px 2px 8px rgba(0,0,0,0.1);
		padding: 1em;
		background-color: #FFFFFF;
		font-family: 'Roboto Mono', monospace;
	}
  .result {
		font-size: 2em;
    text-align: center;
	}
  .explanation {
    font-size: 1.5em;
    text-align: center;
  }
</style>