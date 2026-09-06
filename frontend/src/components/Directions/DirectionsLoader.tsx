"use client";
import dynamic from "next/dynamic";
const Directions = dynamic(() => import("./Directions"), { ssr: false });
export default Directions;
