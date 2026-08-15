import type { Metadata } from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";


import Navbar from "@/components/Navbar/Navbar";

import Footer from "@/components/Footer/Footer";

import ThemeProvider from "@/components/ThemeProvider/ThemeProvider";



const geistSans = Geist({

  variable:
  "--font-geist-sans",

  subsets:["latin"],

});



const geistMono = Geist_Mono({

  variable:
  "--font-geist-mono",

  subsets:["latin"],

});




export const metadata: Metadata = {

  title:"CityVerse",

  description:
  "Discover amazing cities, places and experiences around the world.",

};




export default function RootLayout({

  children,

}: Readonly<{

  children:React.ReactNode;

}>) {


return (

<html

lang="en"

suppressHydrationWarning

className={`${geistSans.variable} ${geistMono.variable}`}

>


<body className="min-h-screen">


<ThemeProvider>


<Navbar />


<main className="min-h-screen">

{children}

</main>


<Footer />


</ThemeProvider>


</body>


</html>

);


}
