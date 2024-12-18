import { useEffect } from 'react';
import mermaid from 'mermaid';

const Mermaid = ({ chartCode }) => {
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
    mermaid.contentLoaded();
  }, [chartCode]);

  return (
    <div className="mermaid">
      {chartCode}
    </div>
  );
};

export default Mermaid;
