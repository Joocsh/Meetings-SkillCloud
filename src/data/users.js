// Central user store (simulates a backend database in this demo)
// role: 'admin' → redirects to /admin dashboard
// role: 'user'  → redirects to /dashboard (associate view)

export let USERS = [
  { id: 0,  name: 'Joshua Rodriguez', avatar: 'JR', username: 'joshua.rodriguez', password: '123', role: 'admin' },
  { id: 1,  name: 'John Doe',         avatar: 'JD', username: 'john.doe',         password: '123', role: 'user'  },
  { id: 2,  name: 'Jane Smith',       avatar: 'JS', username: 'jane.smith',       password: '123', role: 'user'  },
  { id: 3,  name: 'Michael Johnson',  avatar: 'MJ', username: 'michael.johnson',  password: '123', role: 'user'  },
  { id: 4,  name: 'Emily Davis',      avatar: 'ED', username: 'emily.davis',      password: '123', role: 'user'  },
  { id: 5,  name: 'Robert Wilson',    avatar: 'RW', username: 'robert.wilson',    password: '123', role: 'user'  },
];

export const findUser = (username, password) =>
  USERS.find(u => u.username === username && u.password === password) || null;
