import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CollapsibleTree from './CollapsibleTree';


export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    axios.get('/data/osintData.json')
      .then(response => {
        if (isMounted) {
          setData(response.data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Error fetching OSINT data:', err);
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <CollapsibleTree data={data} />;
}
