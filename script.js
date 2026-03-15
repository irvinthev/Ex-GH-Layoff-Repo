async function loadDirectory() {

const response = await fetch("people.json");
const people = await response.json();

const container = document.getElementById("directory");

function render(list) {
container.innerHTML = "";

```
list.forEach(person => {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <h3>${person.full_name}</h3>
    <p><strong>Former Role:</strong> ${person.former_role}</p>
    <p><strong>Function:</strong> ${person.function}</p>
    <p><strong>Location:</strong> ${person.location}</p>
    <p><strong>Looking For:</strong> ${person.looking_for}</p>
    <p><a href="${person.linkedin}" target="_blank">LinkedIn</a></p>
  `;

  container.appendChild(card);
});
```

}

render(people);

document.getElementById("search").addEventListener("input", e => {

```
const query = e.target.value.toLowerCase();

const filtered = people.filter(p =>
  Object.values(p).some(val =>
    val.toLowerCase().includes(query)
  )
);

render(filtered);
```

});

}

loadDirectory();
