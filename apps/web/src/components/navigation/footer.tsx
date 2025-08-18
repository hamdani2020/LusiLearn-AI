import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Mail, Twitter, Linkedin, Github, Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">LusiLearn AI</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              Personalized AI-enhanced learning platform for K-12, college, and professional development. 
              Learn at your own pace with intelligent content recommendations and peer collaboration.
            </p>
            <div className="flex space-x-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/register">Get Started</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h3 className="font-semibold mb-4">Connect</h3>
            <ul className="space-y-2">
              <li>
                <Link href="mailto:contact@lusilearn.ai" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="https://twitter.com/lusilearn" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter
                </Link>
              </li>
              <li>
                <Link href="https://linkedin.com/company/lusilearn" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  <Linkedin className="h-4 w-4 mr-2" />
                  LinkedIn
                </Link>
              </li>
              <li>
                <Link href="https://github.com/lusilearn" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4 md:mb-0">
            <span>© 2024 LusiLearn AI. All rights reserved.</span>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <div className="flex items-center space-x-1">
              <span>Made with</span>
              <Heart className="h-3 w-3 text-red-500" />
              <span>for learners</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 