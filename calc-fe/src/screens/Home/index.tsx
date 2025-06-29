import React, { useEffect, useRef, useState } from "react";
import { SWATCHES } from "@/constants";
import { ColorSwatch, Group } from "@mantine/core";
import { Button } from "@mantine/core";
import axios from "axios";
import "katex/dist/katex.min.css";
import Latex from "react-latex-next";

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

interface GeneratedResult {
  expression: string;
  answer: string;
}

type LatexItem = { id: string; latex: string; x: number; y: number };

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [color, setColor] = useState("rgb(255, 255, 255)");
  const [reset, setReset] = useState(false);
  const [result, setResult] = useState<GeneratedResult>();
  const [dictOfVars, setDictOfVars] = useState({});
  const [latexExpression, setLatexExpression] = useState<LatexItem[]>([]);
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setReset(false);
      setResult(undefined);
      setLatexExpression([]);
      setDictOfVars({});
    }
  }, [reset]);

  useEffect(() => {
    if (latexExpression.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      }, 0);
    }

    console.log(latexExpression);
    console.log(latexPosition);
  }, [latexExpression]);

  useEffect(() => {
    if (result) {
      renderLatexToCanvas(result.expression, result.answer);
    }
  }, [result]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.style.background = "black";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
    }

    const script = document.createElement("script");
    script.src = "";
    script.async = true;
    document.head.appendChild(script);
    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
        },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    id: string,
    x: number,
    y: number
  ) => {
    e.stopPropagation();
    setDraggedId(id);
    setOffset({ x: e.clientX - x, y: e.clientY - y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggedId) {
      setLatexExpression((prev) =>
        prev.map((item) =>
          item.id === draggedId
            ? {
                ...item,
                x: e.clientX - offset.x,
                y: e.clientY - offset.y,
              }
            : item
        )
      );
    }
  };

  const handleMouseUp = () => {
    setDraggedId(null);
  };

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const escapeLatex = (str: string) =>
      str.replace(/\\/g, "\\textbackslash{}").replace(/([#%&~_^{}])/g, "\\$1");

    const escapedExpr = `\\text{${escapeLatex(expression)}}`;
    const escapedAnswer =
      typeof answer === "string" && /[a-zA-Z]/.test(answer)
        ? `\\text{${escapeLatex(answer)}}`
        : answer;

    const latex = `\\(\\LARGE{${escapedExpr} => ${escapedAnswer}}\\)`;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setLatexExpression((prev) => [
      ...prev,
      {
        id,
        latex,
        x: latexPosition.x,
        y: latexPosition.y,
      },
    ]);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const sendData = async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const response = await axios({
        method: "post",
        url: `${import.meta.env.VITE_API_URL}/calculate`,
        data: {
          image: canvas.toDataURL("image/png"),
          dict_of_vars: dictOfVars,
        },
      });
      const resp = await response.data;

      resp.data.forEach((data: Response) => {
        if (data.assign) {
          setDictOfVars({
            ...dictOfVars,
            [data.expr]: data.result,
          });
        }
      });

      const ctx = canvas.getContext("2d");
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            // If pixel is not transparent
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setLatexPosition({ x: centerX, y: centerY });
      resp.data.forEach((data: Response) => {
        setTimeout(() => {
          setResult({
            expression: data.expr,
            answer: data.result,
          });
        }, 1000);
      });
    }
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setIsDrawing(true);
      }
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.strokeStyle = color;
          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          ctx.stroke();
        }
      }
    }
  };

  return (
    <>
      <div className="flex justify-around">
        <Button
          onClick={() => setReset(true)}
          variant="default"
          color="black"
          className="z-20 bg-black text-white"
        >
          Reset
        </Button>
        <Group className="z-20">
          {SWATCHES.map((swatchColor) => (
            <ColorSwatch
              key={swatchColor}
              color={swatchColor}
              onClick={() => setColor(swatchColor)}
            />
          ))}
        </Group>
        <Button
          onClick={sendData}
          variant="default"
          color="black"
          className="z-20 bg-black text-white"
        >
          Calculate
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        id="canvas"
        className="absolute z-10 top-0 left-0 w-full h-full"
        onMouseDown={startDrawing}
        onMouseOut={stopDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={draw}
      />
      <div
        className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {latexExpression.map(({ id, latex, x, y }) => (
          <div
            key={id}
            onMouseDown={(e) => handleMouseDown(e, id, x, y)}
            className="absolute cursor-move text-white pointer-events-auto"
            style={{ left: x, top: y }}
          >
            <Latex>{latex}</Latex>
          </div>
        ))}
      </div>
    </>
  );
}

export default Home;
