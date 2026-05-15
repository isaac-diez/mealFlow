async function test() {
  const user = { email: "test" + Date.now() + "@test.com", password: "password", name: "test" };
  
  await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });

  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });
  const data = await loginRes.json();
  const token = data.token;

  const authHeaders = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
  };

  const groupRes = await fetch("http://localhost:3000/api/groups", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "Test Group" })
  });
  const group = await groupRes.json();
  console.log("Group created", group);

  const dishRes = await fetch("http://localhost:3000/api/groups/" + group.id + "/dishes", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "Test Dish" })
  });
  console.log("Dish status", dishRes.status);
  const dishText = await dishRes.text();
  console.log("Dish response", dishText);
}

test().catch(console.error);
