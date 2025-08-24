"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { useCreateLearningPath } from '@/hooks/use-learning-data'

interface CreateLearningPathModalProps {
  onSuccess?: () => void
}

export function CreateLearningPathModal({ onSuccess }: CreateLearningPathModalProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    subject: '',
    objective: '',
    timeline: '2 weeks',
    priority: 'medium' as 'low' | 'medium' | 'high'
  })

  const createLearningPath = useCreateLearningPath()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.subject.trim() || !formData.objective.trim()) {
      alert('Please fill in all required fields')
      return
    }

    try {
      console.log('Creating learning path...', formData)
      
      const result = await createLearningPath.mutateAsync({
        subject: formData.subject,
        goals: [{
          objective: formData.objective,
          timeline: formData.timeline,
          priority: formData.priority
        }]
      })

      console.log('Learning path created successfully:', result)
      alert(`Learning path "${formData.subject}" created successfully with ${result?.objectives?.length || 0} objectives!`)
      
      setOpen(false)
      setFormData({ subject: '', objective: '', timeline: '2 weeks', priority: 'medium' })
      
      // Trigger refresh of learning paths
      onSuccess?.()
      
      // Force a page refresh to ensure the new path appears
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      console.error('Failed to create learning path:', error)
      alert(`Failed to create learning path: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>New Path</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Learning Path</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="e.g., JavaScript Fundamentals, Python Basics"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="objective">Learning Goal *</Label>
            <Textarea
              id="objective"
              placeholder="What do you want to learn? e.g., Master JavaScript basics including variables, functions, and control structures"
              value={formData.objective}
              onChange={(e) => setFormData(prev => ({ ...prev, objective: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timeline">Timeline</Label>
            <Select value={formData.timeline} onValueChange={(value) => setFormData(prev => ({ ...prev, timeline: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1 week">1 week</SelectItem>
                <SelectItem value="2 weeks">2 weeks</SelectItem>
                <SelectItem value="1 month">1 month</SelectItem>
                <SelectItem value="3 months">3 months</SelectItem>
                <SelectItem value="6 months">6 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setFormData(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLearningPath.isPending}>
              {createLearningPath.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Path'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 