export function HowItWorksSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-emerald-50 to-green-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-balance">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto text-pretty">
            Simple steps to start your carbon offset journey and manage your environmental impact portfolio
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="shadow-lg p-8 md:p-12">
            <img
  src="/buy.jpeg"
  alt="How to manage your portfolio - 5 step process: Signup & Login, Access Offset Portal, Validate on Blockchain, Buy carbon-credits, Manage portfolio"
  className="w-full h-auto rounded-lg"
  width={800}
  height={600}
/>

          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* You can add text/cards here later */}
          </div>
        </div>
      </div>
    </section>
  )
}
