"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";


export default function ThemeToggle(){

  const {
    theme,
    setTheme
  } = useTheme();


  const [mounted,setMounted]=useState(false);


  useEffect(()=>{
    setMounted(true);
  },[]);


  if(!mounted) return null;


  function changeTheme(){

    if(theme==="light"){
      setTheme("dark");
    }

    else if(theme==="dark"){
      setTheme("system");
    }

    else{
      setTheme("light");
    }

  }


  return(

    <button
      onClick={changeTheme}
      className="
      flex
      h-10
      w-10
      items-center
      justify-center
      rounded-xl
      border
      border-slate-200
      bg-white
      text-slate-700
      shadow-sm
      transition
      hover:scale-105
      dark:border-slate-700
      dark:bg-slate-900
      dark:text-white
      "
    >

      {
        theme==="system"
        ?
        <Monitor size={18}/>
        :
        theme==="dark"
        ?
        <Sun size={18}/>
        :
        <Moon size={18}/>
      }


    </button>

  );

}
