async function loadDirectory() {
  const response = await fetch("./people.json");
  const people = await response.json();

  const container = document.getElementById("directory");
  const searchBox = document.getElementById("search");

  function render(list) {
    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = "<p>No matching results found.</p>";
      return;
    }

    list.forEach(person => {
      const name = person["Name"] || person["First Name"] || "Unnamed Person";
      const formerRole = person["Former Job Title"] || "Not listed";
      const team = person["Team"] || "Not listed";
      const jobFunction = person["Function"] || "Not listed";
      const location = person["Remote/Location"] || "Not listed";
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
        ${description ? `<p><strong>About:</strong> ${description}</p>` : ""}
        ${
          linkedin
            ? `<p><a href="${linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>`
            : `<p>No LinkedIn provided</p>`
        }
      `;

      container.appendChild(card);
    });
  }

  render(people);

  searchBox.addEventListener("input", e => {
    const query = e.target.value.toLowerCase();

    const filtered = people.filter(person =>
      Object.values(person).some(val =>
        String(val).toLowerCase().includes(query)
      )
    );

    render(filtered);
  });
}

loadDirectory();
