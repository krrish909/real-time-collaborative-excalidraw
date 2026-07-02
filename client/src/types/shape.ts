export type Point = { x: number; y: number };

export type PenShape = {
  id: string;
  type: "pen";
  points: Point[];
  color: string;
  width: number;
};

export type RectShape = {
  id: string;
  type: "rect";
  start: Point;
  end: Point;
  color: string;
  width: number;
};

// Union — extend here as new shapes are added
export type Shape = PenShape | RectShape;

export type Tool = "pen" | "rect" | "select" | "eraser";
