"use client";

import {
  Monitor,
  Moon,
  Sun,
} from "lucide-react";

import {
  useTheme,
} from "next-themes";

import {
  useEffect,
  useState,
} from "react";


export default function ThemeToggle() {
  const {
    theme,
    setTheme,
  } = useTheme();

  const [mounted, setMounted] =
    useState(false);

  const [open, setOpen] =
    useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);


  if (!mounted) return null;


  const options = [
    {
      name: "Light",
      value: "light",
      icon: Sun,
    },
    {
      name: "Dark",
      value: "dark",
      icon: Moon,
    },
    {
      name: "System",
      value: "system",
      icon: Monitor,
    },
  ];


  const current =
    options.find(
      (item) => item.value === theme
    ) || options[2];


  const Icon = current.icon;


  return (
    <div className="relative">

      <button
        type="button"
        onClick={() =>
          setOpen(!open)
        }
        aria-label="Theme selector"
        className="
          flex h-11 w-11
          items-center justify-center
          rounded-xl
          border border-slate-200
          bg-white/60
          text-slate-900
          transition-all
          duration-300
          hover:border-orange-400/40
          hover:bg-orange-400/10
          dark:border-white/10
          dark:bg-white/5
          dark:text-white
        "
      >
        <Icon size={19} />
      </button>


      {open && (
        <div
          className="
            absolute
            right-0
            top-14
            w-40
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-2
            shadow-xl
            dark:border-slate-700
            dark:bg-slate-900
          "
        >

          {options.map(
            ({
              name,
              value,
              icon: OptionIcon,
            }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-3
                  py-2.5
                  text-sm
                  font-semibold
                  text-slate-700
                  transition
                  hover:bg-slate-100

                  dark:text-slate-200
                  dark:hover:bg-slate-800
                "
              >

                <OptionIcon size={17}/>

                {name}

              </button>
            )
          )}

        </div>
      )}

    </div>
  );
}
