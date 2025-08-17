import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, 
  Users, 
  Target, 
  Shield, 
  Zap, 
  BookOpen, 
  GraduationCap, 
  Globe,
  Award,
  Heart,
  Lightbulb,
  TrendingUp
} from 'lucide-react'
import { PublicNav } from '@/components/navigation/public-nav'
import { Footer } from '@/components/navigation/footer'

export default function AboutPage() {
  return (
    <>
      <PublicNav />
      
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight lg:text-6xl mb-6">
              About <span className="text-primary">LusiLearn AI</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              We're revolutionizing education through artificial intelligence, making personalized learning 
              accessible to everyone, everywhere.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/register">Start Learning Today</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="#mission">Our Mission</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section id="mission" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
                To democratize education by leveraging artificial intelligence to create personalized, 
                adaptive learning experiences that empower learners of all ages and backgrounds to achieve 
                their full potential.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Brain className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle>AI-Powered Learning</CardTitle>
                  <CardDescription>
                    Advanced algorithms that adapt to individual learning styles and progress
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Globe className="h-8 w-8 text-green-600" />
                  </div>
                  <CardTitle>Global Accessibility</CardTitle>
                  <CardDescription>
                    Breaking down barriers to quality education worldwide
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <Heart className="h-8 w-8 text-purple-600" />
                  </div>
                  <CardTitle>Learner-Centric</CardTitle>
                  <CardDescription>
                    Every feature designed with the learner's success in mind
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">Our Vision</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  We envision a world where every individual has access to personalized, high-quality education 
                  that adapts to their unique needs and learning journey.
                </p>
                <p className="text-lg text-muted-foreground mb-8">
                  Through the power of AI, we're building an educational ecosystem that not only teaches 
                  but learns alongside each student, continuously improving and adapting to maximize learning outcomes.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Personalized Learning</Badge>
                  <Badge variant="secondary">AI-Driven</Badge>
                  <Badge variant="secondary">Global Reach</Badge>
                  <Badge variant="secondary">Continuous Innovation</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Target className="h-12 w-12 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Adaptive Learning</h3>
                    <p className="text-sm text-muted-foreground">
                      Content that evolves with your progress
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Users className="h-12 w-12 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Peer Collaboration</h3>
                    <p className="text-sm text-muted-foreground">
                      Connect with learners worldwide
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6 text-center">
                    <TrendingUp className="h-12 w-12 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Progress Tracking</h3>
                    <p className="text-sm text-muted-foreground">
                      Detailed insights into your journey
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Shield className="h-12 w-12 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Safe Learning</h3>
                    <p className="text-sm text-muted-foreground">
                      Age-appropriate content & controls
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-6">Our Core Values</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                These principles guide everything we do, from product development to user experience
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Lightbulb className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle>Innovation</CardTitle>
                  <CardDescription>
                    Continuously pushing the boundaries of what's possible in educational technology
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <Heart className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle>Empathy</CardTitle>
                  <CardDescription>
                    Understanding and addressing the real needs of learners and educators
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle>Trust & Safety</CardTitle>
                  <CardDescription>
                    Ensuring a secure and supportive learning environment for all users
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-orange-600" />
                  </div>
                  <CardTitle>Accessibility</CardTitle>
                  <CardDescription>
                    Making quality education available to learners regardless of location or background
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                    <Award className="h-6 w-6 text-red-600" />
                  </div>
                  <CardTitle>Excellence</CardTitle>
                  <CardDescription>
                    Maintaining the highest standards in content quality and user experience
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-indigo-600" />
                  </div>
                  <CardTitle>Impact</CardTitle>
                  <CardDescription>
                    Measuring success by the positive change we create in learners' lives
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Technology Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-6">Powered by Advanced Technology</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Our platform leverages cutting-edge AI and machine learning technologies to deliver 
                personalized learning experiences
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="text-center">
                <CardHeader>
                  <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Machine Learning</CardTitle>
                  <CardDescription>
                    Adaptive algorithms that learn from user interactions
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Content Curation</CardTitle>
                  <CardDescription>
                    AI-powered selection of relevant learning materials
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Progress Analytics</CardTitle>
                  <CardDescription>
                    Advanced tracking and insights for learning optimization
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Collaborative AI</CardTitle>
                  <CardDescription>
                    Intelligent peer matching and group formation
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Learning?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of learners who are already experiencing the future of education 
              with LusiLearn AI.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/register">Get Started Free</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  )
} 