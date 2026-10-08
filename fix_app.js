const fs = require('fs');
const file = 'apps/restaurant-admin/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Initial Fetch\s+useEffect\(\(\) => \{[\s\S]*?\}, \[activeTab\]\);\s+if \(loading\) return <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">Loading\.\.\.<\/div>;\s+if \(!user\) return <Login \/>;\s+const fetchOrders = \(\) => \{[\s\S]*?  \};\s+const fetchRestaurant = \(\) => \{[\s\S]*?  \};/m;

const replacement = `const fetchOrders = () => {
    fetch(\`\${API_URL}/kitchen/orders\`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then(data => {
        setOrders(data);
        setError(null);
      })
      .catch(err => setError('Connection lost'));
  };

  const fetchRestaurant = () => {
    fetch(\`\${API_URL}/restaurant/current\`)
      .then(res => res.json())
      .then(data => setRestaurant(data))
      .catch(err => console.error(err));
  };

  // Initial Fetch
  useEffect(() => {
    fetchOrders();
    fetchRestaurant();
    const interval = setInterval(() => {
      if (activeTab === 'KITCHEN') fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">Loading...</div>;
  if (!user) return <Login />;`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
