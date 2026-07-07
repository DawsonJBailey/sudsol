"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const slides = [
  {
    src: "https://images.pexels.com/photos/5231237/pexels-photo-5231237.jpeg?auto=compress&cs=tinysrgb&w=1920",
    alt: "Worker rolling out fresh sod onto prepared ground",
  },
  {
    src: "https://images.pexels.com/photos/5231232/pexels-photo-5231232.jpeg?auto=compress&cs=tinysrgb&w=1920",
    alt: "Landscaper laying sod for a new lawn",
  },
  {
    src: "https://images.pexels.com/photos/5231236/pexels-photo-5231236.jpeg?auto=compress&cs=tinysrgb&w=1920",
    alt: "Turf roll being placed on the ground during installation",
  },
  {
    src: "https://images.pexels.com/photos/5231241/pexels-photo-5231241.jpeg?auto=compress&cs=tinysrgb&w=1920",
    alt: "Gardener carrying a strip of sod during installation",
  },
];

const INTERVAL_MS = 5000;

export default function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover transition-opacity duration-[1500ms] ease-in-out ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-pine via-pine/85 to-pine/50" />
      <div className="absolute inset-0 bg-pine-dark/20" />
    </div>
  );
}
