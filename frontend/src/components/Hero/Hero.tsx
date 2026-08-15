"use client";

import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Search,
  MapPin,
  Star,
  Sparkles,
} from "lucide-react";

import { motion } from "framer-motion";


export default function Hero() {


  return (

    <section
      className="
      relative
      min-h-[calc(100vh-80px)]
      overflow-hidden
      "
    >


      {/* Background */}

      <div
        className="
        absolute
        inset-0
        -z-10
        bg-gradient-to-br
        from-orange-50
        via-white
        to-emerald-50
        dark:from-slate-950
        dark:via-slate-950
        dark:to-orange-950
        "
      />



      <motion.div

        animate={{
          scale:[1,1.2,1],
          rotate:[0,20,0]
        }}

        transition={{
          duration:18,
          repeat:Infinity
        }}

        className="
        absolute
        -left-40
        top-20
        h-96
        w-96
        rounded-full
        bg-orange-400/20
        blur-3xl
        "

      />



      <motion.div

        animate={{
          scale:[1,1.1,1],
          rotate:[0,-20,0]
        }}

        transition={{
          duration:15,
          repeat:Infinity
        }}

        className="
        absolute
        -right-40
        bottom-10
        h-96
        w-96
        rounded-full
        bg-emerald-400/20
        blur-3xl
        "

      />




      <div
        className="
        mx-auto
        max-w-7xl
        px-6
        py-24
        "
      >


        <div
          className="
          grid
          items-center
          gap-16
          lg:grid-cols-2
          "
        >


          {/* LEFT */}


          <div>


            <motion.div

              initial={{
                opacity:0,
                y:20
              }}

              animate={{
                opacity:1,
                y:0
              }}

              className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-orange-200
              bg-white/70
              px-5
              py-2
              text-sm
              font-semibold
              text-orange-600
              backdrop-blur-xl
              dark:border-orange-900
              dark:bg-slate-900/70
              dark:text-orange-400
              "

            >

              <Sparkles size={16}/>

              Discover new experiences


            </motion.div>




            <motion.h1

              initial={{
                opacity:0,
                y:40
              }}

              animate={{
                opacity:1,
                y:0
              }}

              transition={{
                delay:.15
              }}

              className="
              mt-8
              text-5xl
              font-black
              leading-tight
              text-main
              sm:text-7xl
              "

            >

              Discover the world,

              <br/>

              <span className="gradient-text">

                one city at a time.

              </span>


            </motion.h1>




            <motion.p

              initial={{
                opacity:0
              }}

              animate={{
                opacity:1
              }}

              transition={{
                delay:.4
              }}

              className="
              mt-6
              max-w-xl
              text-lg
              leading-8
              text-muted
              "

            >

              Explore cities, discover hidden places,
              read real traveler reviews and create unforgettable journeys.

            </motion.p>





            {/* SEARCH */}



            <motion.div

              initial={{
                opacity:0,
                scale:.95
              }}

              animate={{
                opacity:1,
                scale:1
              }}

              transition={{
                delay:.6
              }}

              className="
              mt-10
              "

            >


              <div
                className="
                flex
                items-center
                gap-3
                rounded-3xl
                border
                border-main
                bg-card/80
                px-6
                py-5
                shadow-xl
                backdrop-blur-xl
                "

              >

                <Search
                  className="text-muted"
                />


                <input

                  placeholder="
                  Search cities, places or experiences...
                  "

                  className="
                  w-full
                  bg-transparent
                  outline-none
                  text-main
                  "

                />


              </div>


            </motion.div>





            {/* BUTTONS */}


            <div
              className="
              mt-10
              flex
              flex-wrap
              gap-4
              "
            >


              <Link

                href="/cities"

                className="
                group
                flex
                items-center
                gap-2
                rounded-2xl
                bg-orange-600
                px-7
                py-4
                font-bold
                text-white
                transition
                hover:scale-105
                hover:bg-orange-700
                "

              >

                Explore Cities

                <ArrowRight
                  size={18}
                  className="
                  transition
                  group-hover:translate-x-1
                  "
                />

              </Link>




              <Link

                href="/places"

                className="
                rounded-2xl
                border
                border-main
                bg-card
                px-7
                py-4
                font-bold
                text-main
                transition
                hover:scale-105
                "

              >

                Browse Places

              </Link>



            </div>



          </div>





          {/* RIGHT */}


          <div
            className="
            relative
            hidden
            h-[520px]
            lg:block
            "
          >



            <motion.div

              animate={{
                y:[0,-20,0]
              }}

              transition={{
                duration:5,
                repeat:Infinity
              }}

              className="
              absolute
              right-10
              top-20
              w-72
              rounded-3xl
              border
              bg-card/80
              p-7
              shadow-2xl
              backdrop-blur-xl
              "

            >

              <MapPin
                className="text-orange-600"
              />

              <h3 className="
              mt-5
              text-2xl
              font-black
              text-main
              ">

                Jakarta

              </h3>


              <p className="text-muted">

                Indonesia

              </p>


            </motion.div>






            <motion.div

              animate={{
                y:[0,20,0]
              }}

              transition={{
                duration:6,
                repeat:Infinity
              }}

              className="
              absolute
              bottom-20
              left-10
              rounded-3xl
              border
              bg-card/80
              p-7
              shadow-2xl
              backdrop-blur-xl
              "

            >

              <Star
                className="
                fill-yellow-400
                text-yellow-400
                "
              />


              <h3 className="
              mt-5
              text-xl
              font-bold
              text-main
              ">

                4.9 Rating

              </h3>


              <p className="text-muted">

                Trusted traveler reviews

              </p>


            </motion.div>



          </div>



        </div>


      </div>


    </section>

  );
}
