type RatingProps = {
  value: number;
};


export default function Rating({
  value,
}: RatingProps) {

  const stars = Math.round(value);


  return (
    <div className="mt-4 flex items-center gap-1">

      {
        Array.from({length:5}).map((_,index)=>(
          <span key={index}>
            {index < stars ? "⭐" : "☆"}
          </span>
        ))
      }


      <span className="ml-2 text-sm text-gray-600">
        {value.toFixed(1)}
      </span>

    </div>
  );
}
