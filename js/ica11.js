const customName = document.getElementById("custom-name");
const generateBtn = document.querySelector(".generate");
const story = document.querySelector(".story");

function randomValueFromArray(array) {
  const random = Math.floor(Math.random() * array.length);
  return array[random];
}

const characters = ["Gary, the homeless man,", "the mailman", "a guy in a bathrobe"];
const places = ["the sidewalk", "the driveway", "the alley"];
const events = [
  "yelling about how the daisies keep coming",
  "arguing with a lawn sprinkler",
  "telling a traffic cone to move out of the way",
];

function returnRandomStoryString() {
  const randomCharacter = randomValueFromArray(characters);
  const randomPlace = randomValueFromArray(places);
  const randomEvent = randomValueFromArray(events);

  let storyText = `It was 98 degrees F out. ${randomCharacter} was walking along ${randomPlace} next to Bob's house, ${randomEvent}, and saying that he was only 4 pounds over.`;
  return storyText;
}

generateBtn.addEventListener("click", generateStory);

function generateStory() {
  let newStory = returnRandomStoryString();

  if (customName.value !== "") {
    const name = customName.value;
    newStory = newStory.replace("Bob", name);
  }

  if (document.getElementById("uk").checked) {
    const weight = `${Math.round((4 / 14) * 100) / 100} stone`;
    const temperature = `${Math.round((98 - 32) * (5 / 9))} degrees C`;
    newStory = newStory.replace("4 pounds", weight);
    newStory = newStory.replace("98 degrees F", temperature);
  }

  story.textContent = newStory;
  story.style.visibility = "visible";
}
