<script>
  import Snake from "./Snake.svelte";
  import Food from "./Food.svelte";
  import Questionbox from "./Questionbox.svelte";
  import Answerbox from "./Answerbox.svelte";

  function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  let questions = [
    {
        'question': 'Which password is stronger?',
        'correct': 'paulsimon',
        'incorrect': 'janice',
        'explanation': 'Longer passwords are better.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'basketball15',
        'incorrect': 'heartbreaker',
        'explanation': 'Adding numbers makes the password stronger.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'HotChocolate',
        'incorrect': 'peanutbutter',
        'explanation': 'Adding capitals makes the password stronger.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': '(tinkerbell)',
        'incorrect': 'peaceandlove',
        'explanation': 'Adding special characters makes the password stronger.'
    },
    {
        'question': 'Which password is stronger',
        'correct': 'Greenm0nster',
        'incorrect': 'OrlandoBloom',
        'explanation': "'Greenm0nster' has an uppercase and a number, 'OrlandoBloom' has only lowercase and uppercase."
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'mydogisBecky',
        'incorrect': 'Transformers',
        'explanation': 'Capitalizing the first character is more easily guessed by a hacker.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'neoalejapkeh',
        'incorrect': '892337850912',
        'explanation': 'Letters are stronger than numbers as there are more letters to guess.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'boxrtlpanwbd',
        'incorrect': 'supernatural',
        'explanation': 'Random passwords are stronger than dictionary words.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'smartlyscored',
        'incorrect': 'wewillrockyou',
        'explanation': "'We will rock you' is a recognizable phrase and easier to guess."
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'bootleg918',
        'incorrect': 'b00tlegger',
        'explanation': 'Replacing letters with numbers that look similar is an easily guessed pattern.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'samantha0964',
        'incorrect': 'carolina1234',
        'explanation': 'Sequential numbers are easier to guess than random numbers.'
    },
    {
        'question': 'Which password is stronger?',
        'correct': 'superman8290',
        'incorrect': 'football2006',
        'explanation': 'Common date formats are easier to guess than random numbers'
    },
    {
        'question': 'True or false, it is best to use the same strong password accross all accounts.',
        'correct': 'False',
        'incorrect': 'True',
        'explanation': 'If one account gets breached, all accounts with that password are compromised.'
    },
    {
        'question': 'Which is better?',
        'correct': 'Using a password manager',
        'incorrect': 'Remembering all your passwords in your head',
        'explanation': "Computers can guess everything you can remember. Best to let a computer generate good passwords you don't have to remember."
    },
    {
        'question': 'True or false, having a strong password means no hacker could learn your password.',
        'correct': 'False',
        'incorrect': 'True',
        'explanation': 'There are ways a hacker can retrieve even a strong password.'
    },
    {
        'question': 'True or false, it is more secure to use multi factor authentication.',
        'correct': 'True',
        'incorrect': 'False',
        'explanation': 'Multi factor authentication adds another layer of security to your account.'
    },
    {
        'question': "A number you don't recognize asks for your MFA token. Do you give it to them?",
        'correct': 'No',
        'incorrect': 'Yes',
        'explanation': 'Never give a third party your MFA authentication token.'
    },
    {
        'question': "A service you use notifies you your account has been breached. You should",
        'correct': 'Change your password and enable multi factor authentication',
        'incorrect': 'Delete your account',
        'explanation': 'Resetting your password and enabling MFA is usually enough after a breach.',
    },
    {
        'question': 'Which is better?',
        'correct': 'Using software services with good security reputations',
        'incorrect': "Using obscure software services that hackers don't know about",
        'explanation': 'It is best to use software with a strong reputation. Obscure services might not have resources to invest in security'
    },
    {
        'question': 'True or false, it is important to keep all your devices up to date with the latest software updates',
        'correct': 'True',
        'incorrect': 'False',
        'explanation': 'Many updates involve security patches. Not updating is a security risk.'
    },
    {
        'question': 'True or false, iCloud, OneDrive, and Google Drive are good defenses against ransomware',
        'correct': 'True',
        'incorrect': 'False',
        'explanation': 'Having a backup of your information online is a good practice to defend against ransomeware.'
    },
    {
        'question': 'True or false, it is more private to use a VPN.',
        'correct': 'False',
        'incorrect': 'True',
        'explanation': 'Using a VPN just means you trust the VPN provider instead of your Internet Provider.'
    },
  ]
  console.log('you have ' + questions.length + ' questions.');
  shuffle(questions)

  // Initialize some variables
  let question = "";
  let option1 = "";
  let option2 = "";
  let correct = "";
  let incorrect = "";
  let result = "";
  let explanation = "";
  console.log("explanation: " + explanation);
  let collidedIncorrect = false;
  let collidedCorrect = false;
  let answerKey = [];
  let foodEaten = "";
  let correctFood = "food1";
  let answerFoods = ["food1", "food2"];
  let pauseSpeed = 100000000;
  let questionNumber = 0;

  let food1Left = 0;
  let food1Top = 0;
  let food2Left = 0;
  let food2Top = 0;
  let direction = 'right';
  let snakeBodies = [];
  let speed = 100;
  let board = {'width': 1250, 'height': 550};
  let unit = 50;
  let gameOver = false;

  alert("Welcome to Cyber Snake!");
  alert("It's like classic snake, but with questions! Read the question at the top and eat the food associated with the correct answer!");
  alert("You'll have 3 seconds to read the question before you are back in the game.");
  alert("Press OK to start! Good luck!");

  function initVariables () {
    console.log('initializing variables');
    gameOver = false;
    questionNumber = 0;
    result = "";
    explanation = "";
    newQuestion();
  }

  initVariables();

  let clear
  //i got this from svelte REPL and don't know exactly how it works, but it enables the pause button
  $: {
	  clearInterval(clear)
	  clear = setInterval(runGame, speed)
  }

  //draw the game repeatedly
  function runGame() {
    //console.log('speed: ' + ms);
    snakeBodies.pop();
    let { left, top } = snakeBodies[0];
    const directions = {
      'up': {'top': -50, 'left': 0},
      'down': {'top': 50, 'left': 0},
      'left': {'top': 0, 'left': -50},
      'right': {'top': 0, 'left': 50},
      undefined: {'top': 0, 'left': 0}
    }
    top += directions[direction]['top']
    left += directions[direction]['left']
    //console.log('top: ' + top)
    //console.log('left: ' + left)

    const newHead = { left, top };
    snakeBodies = [ newHead, ...snakeBodies];

    // if the snake eats food, create a new food and add a piece to the snake
    if (isCollide(newHead, { left: food1Left, top: food1Top })) {
      foodEaten = 'food1';
    } else if (isCollide(newHead, {left: food2Left, top: food2Top})) {
      foodEaten = 'food2';
    }
    if ((isCollide(newHead, { left: food1Left, top: food1Top })) || (isCollide(newHead, { left: food2Left, top: food2Top }))) {
      console.log('food eaten: ' + foodEaten);
      console.log('correctFood: ' + correctFood);
      explanation = questions[questionNumber - 1]['explanation'];
      if (foodEaten === correctFood) {
        if (questionNumber == questions.length) {
          alert("You won!");
          resetGame();
        }
        newQuestion();
        setSpeed(3000);
        delayedUnpause(3000);
        moveFood();
        snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
        result = "Correct!";
      } else {
        result = "Incorrect.";
        gameOver = true;
      }
      if (questionNumber > 0) {
        console.log('setting explanation: ' + explanation);
        console.log('question number: ' + questionNumber);
      }
    }

    isGameOver()
    if (gameOver) {
      alert("Game Over!\n" + explanation);
      resetGame();
    }
  }

  const delay = ms => new Promise(res => setTimeout(res, ms));
  const delayedUnpause = async (delayTime) => {
    await delay(delayTime);
    console.log("Waited " + delayTime);
    setSpeed(100);
  };
  
  function newQuestion() {
    console.log('getting new question');
    question = questions[questionNumber]['question'];
    incorrect = questions[questionNumber]['incorrect'];
    correct = questions[questionNumber]['correct']
    const answers = [ incorrect, correct ];
    shuffle(answers);
    option1 = answers[0];
    option2 = answers[1];
    correctFood = answerFoods[answers.indexOf(correct)];
    questionNumber++;
    console.log('after getting new question')
    console.log('question number: ' + questionNumber);
    console.log('option1: ' + option1);
    console.log('option2: ' + option2);
    console.log('correct: ' + correct);
    console.log('incorrect: ' + incorrect);
    console.log('correctFood: ' + correctFood);
  }

  function isCollide(a, b) {
    return !(
      a.top < b.top ||
      a.top > b.top ||
      a.left < b.left ||
      a.left > b.left
    );
  }

  function moveFood() {
    food1Top = Math.floor(Math.random() * Math.floor(board.height / unit)) * unit;
    food1Left = Math.floor(Math.random() * Math.floor(board.width / unit)) * unit;
    food2Top = Math.floor(Math.random() * Math.floor(board.height / unit)) * unit;
    food2Left = Math.floor(Math.random() * Math.floor(board.width / unit)) * unit;
    while ((food2Left === food1Left) & (food2Top === food1Top)) {
      food2Top = Math.floor(Math.random() * Math.floor(board.height / unit)) * unit;
      food2Left = Math.floor(Math.random() * Math.floor(board.width / unit)) * unit;
    }
  }

  function isGameOver() {
    //console.log('calling is gameover: ' + gameOver)
    const snakeBodiesNoHead = snakeBodies.slice(1);
    const snakeCollisions = snakeBodiesNoHead.filter(sb => isCollide(sb, snakeBodies[0]));
    if (snakeCollisions.length !== 0) {
      gameOver = true;
    }
    const { top, left } = snakeBodies[0];
    if (top >= board.height|| top < 0 || left >= board.width|| left < 0){
      gameOver = true;
    }
  }

  function setSpeed(newSpeed) {
    console.log('changing speed to ' + newSpeed);
    speed = newSpeed;
  }

  function isOpposite(a, b) {
    const opposites = {
      'up': 'down',
      'down': 'up',
      'left': 'right',
      'right': 'left',
      'none': 'asdf'
    }
    //console.log('a: ' + a)
    //console.log('opposite a: ' + opposites[a])
    //console.log('b: ' + b)
    //console.log('opposite b: ' + opposites[b])
    if (opposites[a] == b) {
      return true
    }
  }

  function onKeyDown(e) {
    //console.log('keyCode: ' + e.keyCode)
    if (e.keyCode == 32) {
      if (speed == pauseSpeed) {
        setSpeed(100);
      } else {
        setSpeed(pauseSpeed);
      }
    }
    const newDirection = getDirectionFromKeyCode(e.keyCode);
    //console.log(newDirection);
    if (!isOpposite(newDirection, direction)) {
      direction = newDirection;
    }
  }

  function resetGame() {
    initVariables();
    moveFood();
    direction = 'right';
    snakeBodies = [
      { left: unit * 2, top: 0 },
      { left: unit * 1, top: 0 },
      { left: unit * 0, top: 0 }
    ]
  }

  function getDirectionFromKeyCode(keyCode) {
    const keyTransform = {
      37: 'left',
      38: 'up',
      39: 'right',
      40: 'down'
    }
    //console.log('keyCode pressed: ' + keyCode)
    //console.log('current direction: ' + direction)
    if ( 36 < keyCode && keyCode < 41) {
      //console.log('new direction: ' + keyTransform[keyCode])
      return keyTransform[keyCode];
    } else {
      //console.log('direction unchanged: ' + direction)
      return direction;
    }
  }
  resetGame();
    //background-image: url("../background.jpg");
</script>


<style>
  main {
    width: 1250px;
    height: 550px;
    border: solid black 1px;
    position: relative;
    margin: 20px auto;
    background-size: contain;
    background-color: #444444;
  }
  h2, h1 {
    text-align: center;
    font-family: 'Roboto Mono', monospace;
  }
  .prompt {
    width: 1250px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: .5em;
    margin: auto;
    position: relative center;
  }
  .header{
    width: 1250px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: .5em;
    margin: auto;
    position: relative center;
  }
</style>

<div class="header">
  <h1>Cyber Snake</h1>
  <h2>Score: {snakeBodies.length - 3}</h2>
</div>
<div class="prompt">
  <Questionbox {question} {option1} {option2}/>
  <Answerbox {result} {explanation}/>
</div>
<main>
  <Snake {snakeBodies} {direction}/>
  <Food {food1Left} {food1Top} {food2Left} {food2Top} />
</main>
<svelte:window on:keydown={onKeyDown} />