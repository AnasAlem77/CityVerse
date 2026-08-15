"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Compass,
  Heart,
  LogIn,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

import ThemeToggle from "../ThemeToggle/ThemeToggle";
import { useRouter } from "next/navigation";


type UserData = {
  id: string;
  email: string;
  name: string;
};


const links = [
  {
    name: "Home",
    href: "/",
  },
  {
    name: "Cities",
    href: "/cities",
  },
  {
    name: "Places",
    href: "/places",
  },
];


export default function Navbar() {

  const router = useRouter();

  const [user,setUser] = useState<UserData | null>(null);
  const [mobileOpen,setMobileOpen] = useState(false);



  useEffect(()=>{

    const loadUser=()=>{

      const data = localStorage.getItem(
        "cityverse_user"
      );


      if(!data){
        setUser(null);
        return;
      }


      try{
        setUser(JSON.parse(data));
      }
      catch{
        setUser(null);
      }

    };


    loadUser();

    window.addEventListener(
      "storage",
      loadUser
    );


    return ()=>{
      window.removeEventListener(
        "storage",
        loadUser
      );
    };


  },[]);



  function logout(){

    localStorage.removeItem(
      "cityverse_token"
    );

    localStorage.removeItem(
      "cityverse_user"
    );


    setUser(null);

    router.push("/");
    router.refresh();

  }



return (

<nav className="
sticky top-0 z-50
border-b
border-white/20
bg-white/70
backdrop-blur-xl
dark:border-slate-800
dark:bg-slate-950/70
">


<div className="
mx-auto
flex
h-20
max-w-7xl
items-center
justify-between
px-6
">


{/* Logo */}

<Link href="/"
className="flex items-center gap-3"
>


<motion.div
whileHover={{
rotate:10,
scale:1.05
}}
className="
flex
h-11
w-11
items-center
justify-center
rounded-2xl
bg-gradient-to-br
from-blue-600
to-cyan-500
text-white
shadow-lg
"
>

<Compass size={23}/>

</motion.div>



<div>

<p className="
text-xl
font-black
tracking-tight
text-slate-900
dark:text-white
">

City
<span className="text-blue-600">
Verse
</span>

</p>


<p className="
text-[11px]
text-slate-400
"
>
Explore beyond limits
</p>

</div>


</Link>





{/* Desktop */}

<div className="
hidden
items-center
gap-8
md:flex
">


{links.map((link)=>(

<Link
key={link.name}
href={link.href}
className="
relative
text-sm
font-semibold
text-slate-600
transition
hover:text-blue-600
dark:text-slate-300
"
>


{link.name}


<motion.span
className="
absolute
-left-1
right-0
-bottom-2
h-[2px]
bg-blue-600
"
initial={{
scaleX:0
}}
whileHover={{
scaleX:1
}}
/>


</Link>

))}



{user && (

<Link
href="/profile"
className="
flex
items-center
gap-2
text-sm
font-semibold
text-slate-600
dark:text-slate-300
"
>

<User size={17}/>

{user.name}

</Link>

)}



{user && (

<Heart
size={20}
className="
cursor-pointer
text-slate-500
transition
hover:text-pink-500
"
/>

)}



<ThemeToggle />



{!user ? (

<Link
href="/login"
className="
flex
items-center
gap-2
rounded-xl
bg-gradient-to-r
from-blue-600
to-cyan-500
px-5
py-2.5
text-sm
font-bold
text-white
shadow-lg
transition
hover:scale-105
"
>

<LogIn size={17}/>

Login

</Link>


):(


<button
onClick={logout}
className="
flex
items-center
gap-2
rounded-xl
border
px-5
py-2.5
text-sm
font-bold
transition
hover:bg-red-50
hover:text-red-600
dark:border-slate-700
"
>

<LogOut size={17}/>

Logout

</button>


)}



</div>





{/* Mobile */}

<div className="
flex
items-center
gap-3
md:hidden
">


<ThemeToggle/>


<button
onClick={()=>setMobileOpen(!mobileOpen)}
className="
rounded-xl
border
p-2
dark:border-slate-700
"
>

{
mobileOpen
?
<X/>
:
<Menu/>
}

</button>


</div>



</div>





<AnimatePresence>

{mobileOpen && (

<motion.div

initial={{
opacity:0,
height:0
}}

animate={{
opacity:1,
height:"auto"
}}

exit={{
opacity:0,
height:0
}}

className="
overflow-hidden
border-t
bg-white
dark:bg-slate-950
md:hidden
"

>


<div className="
flex
flex-col
gap-2
p-5
">


{links.map(link=>(

<Link
key={link.name}
href={link.href}
onClick={()=>setMobileOpen(false)}
className="
rounded-xl
px-4
py-3
font-semibold
hover:bg-slate-100
dark:hover:bg-slate-900
"
>

{link.name}

</Link>

))}


</div>


</motion.div>

)}


</AnimatePresence>



</nav>


);

}
