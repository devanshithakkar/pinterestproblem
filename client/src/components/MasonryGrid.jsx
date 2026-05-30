import PinCard from "./PinCard";

export default function MasonryGrid({
  pins,
  boards,
  activeBoard,
  onMovePin,
  onUpdatePin,
  onDeletePin,
  onPreviewPin,
}) {
  if (!pins.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-black/15 bg-white p-10 text-center">
        <p className="text-lg font-black">No pins yet</p>
        <p className="mt-2 text-sm font-semibold text-black/50">Save an image and the AI will place it here automatically.</p>
      </div>
    );
  }

  return (
    <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
      {pins.map((pin) => (
        <PinCard
          key={pin.id}
          pin={pin}
          boards={boards}
          activeBoard={activeBoard}
          onMovePin={onMovePin}
          onUpdatePin={onUpdatePin}
          onDeletePin={onDeletePin}
          onPreviewPin={onPreviewPin}
        />
      ))}
    </div>
  );
}
