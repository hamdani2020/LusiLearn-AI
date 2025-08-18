import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Users, Brain, Target } from 'lucide-react'
import { PublicNav } from '@/components/navigation/public-nav'
import { Footer } from '@/components/navigation/footer'

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight lg:text-6xl mb-6">
          Welcome to <span className="text-primary">LusiLearn AI</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Personalized AI-enhanced learning platform for K-12, college, and professional development.
          Learn at your own pace with intelligent content recommendations and peer collaboration.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/auth/register">Get Started</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="#features">Learn More</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12">
        <h2 className="text-3xl font-bold text-center mb-12">
          Intelligent Learning Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Brain className="h-8 w-8 text-primary mb-2" />
              <CardTitle>AI-Powered Paths</CardTitle>
              <CardDescription>
                Personalized learning paths that adapt to your progress and learning style
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Multi-Source Content</CardTitle>
              <CardDescription>
                Curated content from YouTube, Khan Academy, and other educational platforms
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Peer Collaboration</CardTitle>
              <CardDescription>
                Connect with study partners and mentors for collaborative learning
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Target className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Progress Tracking</CardTitle>
              <CardDescription>
                Detailed analytics and insights to track your learning journey
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Education Levels Section */}
      <section id="education-levels" className="py-12">
        <h2 className="text-3xl font-bold text-center mb-12">
          Learning for Every Level
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>K-12 Students</CardTitle>
              <CardDescription>Ages 5-18</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Foundational learning in STEM subjects with age-appropriate content and safety features.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Math</Badge>
                <Badge variant="secondary">Science</Badge>
                <Badge variant="secondary">Programming</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>College Students</CardTitle>
              <CardDescription>Ages 18-25</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Specialized learning and skill development for academic and career preparation.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Computer Science</Badge>
                <Badge variant="secondary">Engineering</Badge>
                <Badge variant="secondary">Research</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Professionals</CardTitle>
              <CardDescription>Ages 22+</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Continuous learning and skill updates for career advancement and technology trends.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Web Development</Badge>
                <Badge variant="secondary">AI/ML</Badge>
                <Badge variant="secondary">Leadership</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

    </div>
    
    <Footer />
    </>
  )
}