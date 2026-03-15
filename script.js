async function loadDirectory() {

const response = await fetch("./people.json");
const people = await response.json();

const container = document.getElementById("directory");
const searchBox = document.getElementById("search");
const functionFilter = document.getElementById("functionFilter");
const locationFilter = document.getElementById("locationFilter");

function uniqueValues(field) {
return [...new Set(people.map(p => p[field]).filter(Boolean))].sort();
}

function populateFilters() {

uniqueValues("Function").forEach(f => {
const option = document.createElement("option");
option.value = f;
option.textContent = f;
functionFilter.appendChild(option);
});

uniqueValues("Remote/Location").forEach(l => {
const option = document.createElement("option");
option.value = l;
option.textContent = l;
locationFilter.appendChild(option);
});

}

function render(list) {

container.innerHTML = "";

if (!list.length) {
container.innerHTML = "<p>No matching results found.</p>";
return;
}

list.forEach(person => {

const name = person["Name"] || person["First Name"] || "Unnamed Person";
const formerRole = person["Former Job Title"] || "";
const team = person["Team"] || "";
const jobFunction = person["Function"] || "";
const location = person["Remote/Location"] || "";
const linkedin = person["LinkedIn URL"] || "";
const description = person["Description"] || "";

const card = document.createElement("div");
card.className = "card";

card.innerHTML = `
<h3>${name}</h3>
<p><strong>Former Role:</strong> ${formerRole}</p>
<p><strong>Team:</strong> ${team}</p>
<p><strong>Function:</strong> ${jobFunction}</p>
<p><strong>Location:</strong> ${location}</p>
${description ? `<p>${description}</p>` : ""}
${linkedin ? `<p><a href="${linkedin}" target="_blank">LinkedIn</a></p>` : ""}
`;

container.appendChild(card);

});

}

function applyFilters() {

const query = searchBox.value.toLowerCase();
const selectedFunction = functionFilter.value;
const selectedLocation = locationFilter.value;

const filtered = people.filter(person => {

const matchesSearch =
Object.values(person).some(val =>
String(val).toLowerCase().includes(query)
);

const matchesFunction =
!selectedFunction || person["Function"] === selectedFunction;

const matchesLocation =
!selectedLocation || person["Remote/Location"] === selectedLocation;

return matchesSearch && matchesFunction && matchesLocation;

});

render(filtered);

}

populateFilters();
render(people);

searchBox.addEventListener("input", applyFilters);
functionFilter.addEventListener("change", applyFilters);
locationFilter.addEventListener("change", applyFilters);

}

loadDirectory();
