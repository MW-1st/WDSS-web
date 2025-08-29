import Canvas from "../components/Canvas.jsx";

export default function EditorPage() {
  return (
    <section>
      <h1>Editor</h1>
      <p>간단한 Konva 캔버스 예시입니다.</p>
      <Canvas width={800} height={500} />
    </section>
  );
}
