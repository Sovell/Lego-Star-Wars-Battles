export function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panelTitle">
      <h2>{title}</h2>
      <span>{detail}</span>
    </div>
  );
}
